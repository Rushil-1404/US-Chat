from __future__ import annotations

from pathlib import Path

from flask import Flask, g, jsonify, request
from sqlalchemy import inspect
from werkzeug.exceptions import RequestEntityTooLarge

from .config import Config
from .extensions import db, socketio


def create_app(config_overrides: dict | None = None) -> Flask:
    instance_path = Path(__file__).resolve().parent.parent / "instance"
    app = Flask(__name__, instance_path=str(instance_path), instance_relative_config=False)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    Path(app.config["LOCAL_STORAGE_ROOT"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    socketio.init_app(
        app,
        async_mode=app.config["SOCKETIO_ASYNC_MODE"],
        cors_allowed_origins="*",
        manage_session=False,
    )

    from .auth.routes import auth_bp
    from .conversations.routes import conversations_bp
    from .files.routes import files_bp
    from .messages.routes import messages_bp
    from .settings.routes import settings_bp
    from .users.routes import users_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(conversations_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(settings_bp)

    register_request_hooks(app)
    register_template_context(app)
    register_cli_commands(app)
    register_error_handlers(app)

    from .messages.socketio_events import register_socket_handlers

    register_socket_handlers(socketio)

    with app.app_context():
        from . import models  # noqa: F401
        from .services.seed import ensure_demo_data

        initialize_database()
        if app.config["AUTO_SEED_DEMO"]:
            ensure_demo_data()

    return app


def register_request_hooks(app: Flask) -> None:
    from .services.sessions import load_request_session, touch_last_seen

    @app.before_request
    def load_current_user() -> None:
        load_request_session()
        if g.get("current_user"):
            touch_last_seen(g.current_user)


def register_template_context(app: Flask) -> None:
    @app.context_processor
    def inject_globals() -> dict:
        return {
            "current_user": g.get("current_user"),
            "sharepoint_link": app.config["GRAPH_SHARE_LINK"],
        }


def register_cli_commands(app: Flask) -> None:
    import click

    from .services.seed import ensure_demo_data

    @app.cli.command("init-db")
    def init_db_command() -> None:
        initialize_database()
        click.echo("Database tables created.")

    @app.cli.command("seed-demo")
    def seed_demo_command() -> None:
        ensure_demo_data(force=True)
        click.echo("Demo data created or refreshed.")


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(RequestEntityTooLarge)
    def handle_too_large(_: RequestEntityTooLarge):
        payload = {"ok": False, "error": "file_too_large", "message": "The selected file is too large."}
        if request.path.startswith("/api/"):
            return jsonify(payload), 413
        return payload, 413


def initialize_database() -> None:
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    for table in db.metadata.sorted_tables:
        if table.name not in existing_tables:
            table.create(bind=db.engine, checkfirst=True)
