# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src

RUN npm run build

# Stage 2: Production backend image
FROM python:3.12-slim

# Install system dependencies + ODBC driver for Azure SQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg unixodbc unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
       > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/alembic.ini .
COPY backend/alembic ./alembic
COPY backend/app ./app

# Copy built frontend assets into FastAPI static directory
RUN mkdir -p app/static
COPY --from=frontend-builder /app/frontend/dist ./app/static

# Environment
ENV PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Run migrations then start the API
CMD ["/bin/sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
