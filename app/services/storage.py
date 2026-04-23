from __future__ import annotations

import base64
import shutil
from dataclasses import dataclass
from pathlib import Path

import requests
from flask import current_app


class StorageError(Exception):
    pass


@dataclass
class StoredFile:
    provider: str
    stored_name: str
    folder_path: str
    drive_id: str | None = None
    drive_item_id: str | None = None
    web_url: str | None = None


class StorageProvider:
    name = "base"

    def upload_file(self, source_path: Path, folder_path: str, stored_name: str, mime_type: str) -> StoredFile:  # pragma: no cover - interface
        raise NotImplementedError

    def delete_file(self, *, folder_path: str | None, stored_name: str | None, drive_id: str | None, drive_item_id: str | None) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def get_download_url(self, *, folder_path: str | None, stored_name: str | None, drive_id: str | None, drive_item_id: str | None, fallback_url: str | None = None) -> str | None:  # pragma: no cover - interface
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    name = "local"

    def __init__(self, root_path: str) -> None:
        self.root_path = Path(root_path)
        self.root_path.mkdir(parents=True, exist_ok=True)

    def upload_file(self, source_path: Path, folder_path: str, stored_name: str, mime_type: str) -> StoredFile:
        target_dir = self.root_path / folder_path
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / stored_name
        shutil.copy2(source_path, target_path)
        return StoredFile(provider=self.name, stored_name=stored_name, folder_path=folder_path)

    def delete_file(self, *, folder_path: str | None, stored_name: str | None, drive_id: str | None, drive_item_id: str | None) -> None:
        if not folder_path or not stored_name:
            return
        target_path = self.absolute_path(folder_path, stored_name)
        if target_path.exists():
            target_path.unlink()

    def get_download_url(self, *, folder_path: str | None, stored_name: str | None, drive_id: str | None, drive_item_id: str | None, fallback_url: str | None = None) -> str | None:
        return fallback_url

    def absolute_path(self, folder_path: str, stored_name: str) -> Path:
        return self.root_path / folder_path / stored_name


class GraphStorageProvider(StorageProvider):
    name = "graph"
    base_url = "https://graph.microsoft.com/v1.0"

    def __init__(self) -> None:
        self._access_token: str | None = None
        self._root_drive_id = current_app.config.get("GRAPH_DRIVE_ID") or None
        self._root_item_id = current_app.config.get("GRAPH_ROOT_ITEM_ID") or None

    def upload_file(self, source_path: Path, folder_path: str, stored_name: str, mime_type: str) -> StoredFile:
        drive_id, folder_id = self._ensure_folder(folder_path)
        file_size = source_path.stat().st_size
        if file_size <= current_app.config["GRAPH_SIMPLE_UPLOAD_MAX_BYTES"]:
            endpoint = f"/drives/{drive_id}/items/{folder_id}:/{stored_name}:/content"
            with source_path.open("rb") as source_stream:
                response = self._request("PUT", endpoint, headers={"Content-Type": mime_type}, data=source_stream)
        else:
            response = self._upload_large_file(source_path, drive_id, folder_id, stored_name, mime_type)

        return StoredFile(
            provider=self.name,
            stored_name=stored_name,
            folder_path=folder_path,
            drive_id=response.get("parentReference", {}).get("driveId", drive_id),
            drive_item_id=response.get("id"),
            web_url=response.get("webUrl"),
        )

    def delete_file(self, *, folder_path: str | None, stored_name: str | None, drive_id: str | None, drive_item_id: str | None) -> None:
        if not drive_id or not drive_item_id:
            raise StorageError("Missing drive identifiers for Graph delete.")
        self._request("DELETE", f"/drives/{drive_id}/items/{drive_item_id}")

    def get_download_url(self, *, folder_path: str | None, stored_name: str | None, drive_id: str | None, drive_item_id: str | None, fallback_url: str | None = None) -> str | None:
        if not drive_id or not drive_item_id:
            return fallback_url
        item = self._request("GET", f"/drives/{drive_id}/items/{drive_item_id}")
        return item.get("@microsoft.graph.downloadUrl") or item.get("webUrl") or fallback_url

    def _upload_large_file(self, source_path: Path, drive_id: str, folder_id: str, stored_name: str, mime_type: str) -> dict:
        session = self._request(
            "POST",
            f"/drives/{drive_id}/items/{folder_id}:/{stored_name}:/createUploadSession",
            json={
                "item": {
                    "@microsoft.graph.conflictBehavior": "replace",
                    "name": stored_name,
                }
            },
        )
        upload_url = session["uploadUrl"]
        chunk_size = 5 * 1024 * 1024
        file_size = source_path.stat().st_size

        with source_path.open("rb") as source_stream:
            start = 0
            while True:
                chunk = source_stream.read(chunk_size)
                if not chunk:
                    break
                end = start + len(chunk) - 1
                headers = {
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Content-Type": mime_type,
                }
                raw_response = requests.put(upload_url, headers=headers, data=chunk, timeout=60)
                if raw_response.status_code not in {200, 201, 202}:
                    raise StorageError(f"Large upload failed: {raw_response.text}")
                payload = raw_response.json()
                if raw_response.status_code in {200, 201}:
                    return payload
                start = end + 1

        raise StorageError("Large upload session finished without a final file payload.")

    def _ensure_folder(self, folder_path: str) -> tuple[str, str]:
        drive_id, root_item_id = self._resolve_root_location()
        parent_id = root_item_id
        for segment in [part for part in folder_path.split("/") if part]:
            child = self._find_child_folder(drive_id, parent_id, segment)
            if child:
                parent_id = child["id"]
                continue

            child = self._request(
                "POST",
                f"/drives/{drive_id}/items/{parent_id}/children",
                json={
                    "name": segment,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "fail",
                },
            )
            parent_id = child["id"]
        return drive_id, parent_id

    def _find_child_folder(self, drive_id: str, parent_id: str, folder_name: str) -> dict | None:
        children = self._request("GET", f"/drives/{drive_id}/items/{parent_id}/children")
        for item in children.get("value", []):
            if item.get("name") == folder_name and "folder" in item:
                return item
        return None

    def _resolve_root_location(self) -> tuple[str, str]:
        if self._root_drive_id and self._root_item_id:
            return self._root_drive_id, self._root_item_id

        share_link = current_app.config.get("GRAPH_SHARE_LINK")
        if not share_link:
            raise StorageError("Missing Graph share link configuration.")

        encoded = base64.b64encode(share_link.encode("utf-8")).decode("utf-8").rstrip("=").replace("/", "_").replace("+", "-")
        payload = self._request("GET", f"/shares/u!{encoded}/driveItem")
        parent_reference = payload.get("parentReference", {})
        self._root_drive_id = parent_reference.get("driveId")
        self._root_item_id = payload.get("id")
        if not self._root_drive_id or not self._root_item_id:
            raise StorageError("Unable to resolve Graph drive and root item from the supplied share link.")
        return self._root_drive_id, self._root_item_id

    def _request(self, method: str, endpoint: str, **kwargs):
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self._access_token_for_graph()}"
        response = requests.request(method, f"{self.base_url}{endpoint}", headers=headers, timeout=60, **kwargs)
        if response.status_code >= 400:
            raise StorageError(f"Graph request failed ({response.status_code}): {response.text}")
        if response.status_code == 204:
            return {}
        return response.json()

    def _access_token_for_graph(self) -> str:
        if self._access_token:
            return self._access_token

        tenant_id = current_app.config.get("GRAPH_TENANT_ID")
        client_id = current_app.config.get("GRAPH_CLIENT_ID")
        client_secret = current_app.config.get("GRAPH_CLIENT_SECRET")
        if not tenant_id or not client_id or not client_secret:
            raise StorageError("Graph credentials are not configured.")

        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        response = requests.post(
            token_url,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
                "scope": "https://graph.microsoft.com/.default",
            },
            timeout=60,
        )
        if response.status_code >= 400:
            raise StorageError(f"Unable to acquire Microsoft Graph token: {response.text}")

        payload = response.json()
        self._access_token = payload["access_token"]
        return self._access_token


def get_storage_provider() -> StorageProvider:
    cached_provider = current_app.extensions.get("chat_storage_provider")
    if cached_provider:
        return cached_provider

    storage_mode = current_app.config["STORAGE_MODE"]
    if storage_mode == "graph":
        provider = GraphStorageProvider()
    elif storage_mode == "local":
        provider = LocalStorageProvider(current_app.config["LOCAL_STORAGE_ROOT"])
    else:
        graph_configured = all(
            [
                current_app.config.get("GRAPH_TENANT_ID"),
                current_app.config.get("GRAPH_CLIENT_ID"),
                current_app.config.get("GRAPH_CLIENT_SECRET"),
                current_app.config.get("GRAPH_SHARE_LINK"),
            ]
        )
        provider = GraphStorageProvider() if graph_configured else LocalStorageProvider(current_app.config["LOCAL_STORAGE_ROOT"])

    current_app.extensions["chat_storage_provider"] = provider
    return provider
