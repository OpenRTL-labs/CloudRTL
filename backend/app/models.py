from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    projects = relationship(
        "Project", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}')>"


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_project_user_id_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(100), nullable=False, default="RTL Design Project")
    technology = Column(String(100), nullable=False, default="Nangate45")
    top_module = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="ready")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="projects")
    files = relationship(
        "ProjectFile", back_populates="project", cascade="all, delete-orphan"
    )

    @property
    def project_files(self):
        return self.files

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', type='{self.type}')>"


class ProjectFile(Base):
    __tablename__ = "project_files"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "name", name="uq_project_file_project_id_name"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    project = relationship("Project", back_populates="files")

    def __repr__(self) -> str:
        return f"<ProjectFile(id={self.id}, project_id={self.project_id}, name='{self.name}', type='{self.type}')>"
