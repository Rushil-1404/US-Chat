from __future__ import annotations

import hashlib
import random
import re
import string
from dataclasses import dataclass
from datetime import timedelta

from flask import current_app

from ..extensions import db
from ..models import OtpChallenge, utcnow


PHONE_PATTERN = re.compile(r"^\+[1-9]\d{9,14}$")


def normalize_phone_number(raw_value: str) -> str:
    digits = re.sub(r"\D", "", raw_value or "")
    if not digits:
        return ""
    if len(digits) == 10:
        digits = f"1{digits}"
    return f"+{digits}"


def validate_phone_number(phone_number: str) -> bool:
    return bool(PHONE_PATTERN.fullmatch(phone_number))


def hash_otp(phone_number: str, code: str) -> str:
    material = f"{phone_number}:{code}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


@dataclass
class OtpRequestResult:
    phone_number: str
    expires_in: int
    dev_code: str | None = None


@dataclass
class OtpVerifyResult:
    success: bool
    phone_number: str | None = None
    error: str | None = None


class OtpProvider:
    def request_otp(self, phone_number: str, ip_address: str | None = None) -> OtpRequestResult:  # pragma: no cover - interface
        raise NotImplementedError

    def verify_otp(self, phone_number: str, code: str) -> OtpVerifyResult:  # pragma: no cover - interface
        raise NotImplementedError


class DevOtpProvider(OtpProvider):
    def request_otp(self, phone_number: str, ip_address: str | None = None) -> OtpRequestResult:
        normalized_phone = normalize_phone_number(phone_number)
        if not validate_phone_number(normalized_phone):
            raise ValueError("Enter a valid phone number including country code.")

        self._enforce_rate_limit(normalized_phone)

        code = "".join(random.choice(string.digits) for _ in range(current_app.config["OTP_LENGTH"]))
        challenge = OtpChallenge(
            phone_number=normalized_phone,
            code_hash=hash_otp(normalized_phone, code),
            expires_at=utcnow() + timedelta(seconds=current_app.config["OTP_EXPIRY_SECONDS"]),
            request_ip=ip_address,
        )
        db.session.add(challenge)
        db.session.commit()

        current_app.logger.info("DEV OTP for %s is %s", normalized_phone, code)
        return OtpRequestResult(
            phone_number=normalized_phone,
            expires_in=current_app.config["OTP_EXPIRY_SECONDS"],
            dev_code=code if current_app.config["DEV_OTP_EXPOSE_CODE"] else None,
        )

    def verify_otp(self, phone_number: str, code: str) -> OtpVerifyResult:
        normalized_phone = normalize_phone_number(phone_number)
        if not validate_phone_number(normalized_phone):
            return OtpVerifyResult(success=False, error="Enter a valid phone number.")

        challenge = (
            OtpChallenge.query.filter_by(phone_number=normalized_phone, consumed_at=None)
            .order_by(OtpChallenge.created_at.desc())
            .first()
        )
        now = utcnow()
        if challenge is None or challenge.expires_at < now:
            return OtpVerifyResult(success=False, error="The verification code expired. Request a new one.")

        if challenge.verify_attempts >= current_app.config["OTP_MAX_VERIFY_ATTEMPTS"]:
            return OtpVerifyResult(success=False, error="Too many incorrect attempts. Request a new code.")

        if challenge.code_hash != hash_otp(normalized_phone, (code or "").strip()):
            challenge.verify_attempts += 1
            db.session.commit()
            return OtpVerifyResult(success=False, error="Incorrect verification code.")

        challenge.consumed_at = now
        db.session.commit()
        return OtpVerifyResult(success=True, phone_number=normalized_phone)

    def _enforce_rate_limit(self, phone_number: str) -> None:
        window_start = utcnow() - timedelta(seconds=current_app.config["OTP_RATE_LIMIT_WINDOW_SECONDS"])
        request_count = OtpChallenge.query.filter(
            OtpChallenge.phone_number == phone_number,
            OtpChallenge.created_at >= window_start,
        ).count()
        if request_count >= current_app.config["OTP_MAX_REQUESTS_PER_WINDOW"]:
            raise ValueError("Too many OTP requests. Please wait and try again.")


class SmsOtpProvider(OtpProvider):
    def request_otp(self, phone_number: str, ip_address: str | None = None) -> OtpRequestResult:
        raise RuntimeError("SMS OTP provider is not configured. Use OTP_PROVIDER_MODE=dev for local development.")

    def verify_otp(self, phone_number: str, code: str) -> OtpVerifyResult:
        raise RuntimeError("SMS OTP provider is not configured. Use OTP_PROVIDER_MODE=dev for local development.")


def get_otp_provider() -> OtpProvider:
    provider_mode = current_app.config["OTP_PROVIDER_MODE"]
    if provider_mode == "sms":
        return SmsOtpProvider()
    return DevOtpProvider()
