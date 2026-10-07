import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, ForeignKey, String, Text, create_engine, delete, or_, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/chatbot.db")
if DATABASE_URL.startswith("sqlite:"):
    Path("data").mkdir(exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite:") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def now() -> datetime:
    return datetime.now(timezone.utc)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MessageRevision(Base):
    __tablename__ = "message_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    source_message_id: Mapped[str] = mapped_column(String(36))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    disk_path: Mapped[str] = mapped_column(Text)


Base.metadata.create_all(engine)


def _delete_attachments(session: Session, message_ids: list[str]) -> list[str]:
    if not message_ids:
        return []
    rows = list(session.scalars(select(Attachment).where(Attachment.message_id.in_(message_ids))))
    paths = [row.disk_path for row in rows]
    session.execute(delete(Attachment).where(Attachment.message_id.in_(message_ids)))
    return paths


def _remove_media(paths: list[str]) -> None:
    for path in paths:
        try:
            Path(path).unlink(missing_ok=True)
        except OSError:
            pass


def conversation_list(owner_id: str, query: str = "") -> list[dict[str, str]]:
    with SessionLocal() as session:
        statement = select(Conversation).where(Conversation.owner_id == owner_id)
        if query.strip():
            term = query.strip()[:120]
            matching_messages = select(Message.conversation_id).where(Message.content.contains(term, autoescape=True))
            statement = statement.where(or_(
                Conversation.title.contains(term, autoescape=True),
                Conversation.id.in_(matching_messages),
            ))
        rows = session.scalars(statement.order_by(Conversation.updated_at.desc()).limit(100))
        return [{"id": row.id, "title": row.title, "updated_at": row.updated_at.isoformat()} for row in rows]


def get_conversation(owner_id: str, conversation_id: str) -> tuple[dict[str, str], list[dict[str, str]]] | None:
    with SessionLocal() as session:
        conversation = session.scalar(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.owner_id == owner_id)
        )
        if conversation is None:
            return None
        messages = session.scalars(
            select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at, Message.id)
        )
        return (
            {"id": conversation.id, "title": conversation.title, "updated_at": conversation.updated_at.isoformat()},
            [{"id": row.id, "role": row.role, "content": row.content} for row in messages],
        )


def create_conversation(owner_id: str, title: str) -> str:
    conversation_id = str(uuid.uuid4())
    with SessionLocal.begin() as session:
        session.add(Conversation(id=conversation_id, owner_id=owner_id, title=title[:160]))
    return conversation_id


def add_message(conversation_id: str, role: str, content: str) -> str:
    message_id = str(uuid.uuid4())
    with SessionLocal.begin() as session:
        conversation = session.get(Conversation, conversation_id)
        if conversation is None:
            raise ValueError("Conversation not found")
        session.add(Message(id=message_id, conversation_id=conversation_id, role=role, content=content))
        conversation.updated_at = now()
    return message_id


def update_message(owner_id: str, conversation_id: str, message_id: str, content: str) -> bool:
    media_paths: list[str] = []
    with SessionLocal.begin() as session:
        conversation = session.scalar(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.owner_id == owner_id)
        )
        message = session.get(Message, message_id)
        if conversation is None or message is None or message.conversation_id != conversation_id or message.role != "user":
            return False
        ordered = list(session.scalars(
            select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at, Message.id)
        ))
        index = next((position for position, item in enumerate(ordered) if item.id == message_id), -1)
        removed_messages = ordered[index + 1:]
        removed_ids = [item.id for item in removed_messages]
        for removed in removed_messages:
            if removed.role == "assistant" and removed.content:
                session.add(MessageRevision(
                    conversation_id=conversation_id,
                    source_message_id=removed.id,
                    content=removed.content,
                ))
        if removed_ids:
            media_paths = _delete_attachments(session, removed_ids)
            session.execute(delete(Message).where(Message.id.in_(removed_ids)))
        message.content = content
        conversation.updated_at = now()
    _remove_media(media_paths)
    return True


def remove_last_assistant(owner_id: str, conversation_id: str) -> bool:
    media_paths: list[str] = []
    with SessionLocal.begin() as session:
        conversation = session.scalar(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.owner_id == owner_id)
        )
        if conversation is None:
            return False
        messages = list(session.scalars(
            select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at, Message.id)
        ))
        if not messages or messages[-1].role != "assistant":
            return False
        if messages[-1].content:
            session.add(MessageRevision(
                conversation_id=conversation_id,
                source_message_id=messages[-1].id,
                content=messages[-1].content,
            ))
        media_paths = _delete_attachments(session, [messages[-1].id])
        session.delete(messages[-1])
        conversation.updated_at = now()
    _remove_media(media_paths)
    return True


def delete_message(conversation_id: str, message_id: str) -> None:
    with SessionLocal.begin() as session:
        media_paths = _delete_attachments(session, [message_id])
        session.execute(delete(Message).where(
            Message.id == message_id, Message.conversation_id == conversation_id
        ))
    _remove_media(media_paths)


def delete_conversation(owner_id: str, conversation_id: str) -> bool:
    media_paths: list[str] = []
    with SessionLocal.begin() as session:
        conversation = session.scalar(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.owner_id == owner_id)
        )
        if conversation is None:
            return False
        messages = list(session.scalars(select(Message).where(Message.conversation_id == conversation_id)))
        message_ids = [message.id for message in messages]
        if message_ids:
            media_paths = _delete_attachments(session, message_ids)
            session.execute(delete(Message).where(Message.id.in_(message_ids)))
        session.execute(delete(MessageRevision).where(MessageRevision.conversation_id == conversation_id))
        session.delete(conversation)
    _remove_media(media_paths)
    return True


def conversation_revisions(owner_id: str, conversation_id: str) -> list[dict[str, str]]:
    with SessionLocal() as session:
        allowed = session.scalar(select(Conversation.id).where(
            Conversation.id == conversation_id, Conversation.owner_id == owner_id
        ))
        if allowed is None:
            return []
        rows = session.scalars(select(MessageRevision).where(
            MessageRevision.conversation_id == conversation_id
        ).order_by(MessageRevision.created_at.desc()).limit(20))
        return [{"content": row.content, "created_at": row.created_at.isoformat()} for row in rows]


def add_document(owner_id: str, name: str, content: str) -> str:
    document_id = str(uuid.uuid4())
    with SessionLocal.begin() as session:
        session.add(Document(id=document_id, owner_id=owner_id, name=name[:255], content=content))
    return document_id


def list_documents(owner_id: str) -> list[dict[str, str]]:
    with SessionLocal() as session:
        rows = session.scalars(select(Document).where(Document.owner_id == owner_id).order_by(Document.created_at.desc()))
        return [{"id": row.id, "name": row.name, "created_at": row.created_at.isoformat()} for row in rows]


def search_documents(owner_id: str, query: str, limit: int = 4) -> list[tuple[str, str]]:
    terms = {term.lower() for term in query.split() if len(term) > 2}
    if not terms:
        return []
    with SessionLocal() as session:
        docs = session.scalars(select(Document).where(Document.owner_id == owner_id))
        scored = []
        for document in docs:
            text = document.content.lower()
            score = sum(text.count(term) for term in terms)
            if score:
                position = max((text.find(term) for term in terms if term in text), default=0)
                start = max(0, position - 240)
                scored.append((score, document.name, document.content[start:start + 900]))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [(name, excerpt) for _, name, excerpt in scored[:limit]]


def delete_document(owner_id: str, document_id: str) -> bool:
    with SessionLocal.begin() as session:
        document = session.scalar(select(Document).where(Document.id == document_id, Document.owner_id == owner_id))
        if document is None:
            return False
        session.delete(document)
    return True


def add_attachment(owner_id: str, message_id: str, name: str, mime_type: str, disk_path: str) -> str:
    attachment_id = str(uuid.uuid4())
    with SessionLocal.begin() as session:
        session.add(Attachment(
            id=attachment_id, owner_id=owner_id, message_id=message_id,
            name=name[:255], mime_type=mime_type, disk_path=disk_path,
        ))
    return attachment_id


def attachments_for_messages(owner_id: str, message_ids: list[str]) -> dict[str, list[dict[str, str]]]:
    if not message_ids:
        return {}
    with SessionLocal() as session:
        rows = session.scalars(select(Attachment).where(
            Attachment.owner_id == owner_id, Attachment.message_id.in_(message_ids)
        ))
        output: dict[str, list[dict[str, str]]] = {}
        for row in rows:
            output.setdefault(row.message_id, []).append({
                "id": row.id, "name": row.name, "mime_type": row.mime_type, "disk_path": row.disk_path,
            })
        return output


def get_attachment(owner_id: str, attachment_id: str) -> dict[str, str] | None:
    with SessionLocal() as session:
        row = session.scalar(select(Attachment).where(
            Attachment.id == attachment_id, Attachment.owner_id == owner_id
        ))
        if row is None:
            return None
        return {"name": row.name, "mime_type": row.mime_type, "disk_path": row.disk_path}