# Imagem de PRODUÇÃO da API (Render). O docker-compose.yml é só o banco local.
#
# Construir (contexto = RAIZ do repositório: a imagem precisa de dominio/ e backend/):
#   docker build -f backend/Dockerfile -t tg-backend .
#
# Dois estágios: a "cozinha" instala as bibliotecas; a "marmita" leva só o pronto
# (venv + código), sem pip cache nem arquivos de instalação.

# ------------------------------------------------------------------ 1 · cozinha
FROM python:3.13.7-slim AS cozinha

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Bibliotecas de terceiros primeiro: esta camada só refaz quando o requirements muda.
# A linha "-e ../dominio" (modo editável, de desenvolvimento) fica de fora aqui...
COPY backend/requirements.txt /tmp/requirements.txt
RUN grep -v '^-e ' /tmp/requirements.txt > /tmp/terceiros.txt \
 && pip install -r /tmp/terceiros.txt

# ...e o domínio entra como PACOTE normal (regra 1: instalado, nunca copiado no backend).
COPY dominio/ /tmp/dominio/
RUN pip install /tmp/dominio

# ------------------------------------------------------------------ 2 · marmita
FROM python:3.13.7-slim

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Usuário sem privilégio: se alguém invadir a API, não é dono do contêiner.
RUN useradd --create-home --uid 1000 app

COPY --from=cozinha /opt/venv /opt/venv
# O código pertence ao root e o "app" só lê e executa (755): quem invadir a API não
# consegue alterar o código. (Vindo do disco do Windows, os arquivos chegariam 777.)
COPY --chmod=755 backend/ /app/backend/

USER app
WORKDIR /app/backend

# O Render free não tem pré-deploy nem shell: as migrações rodam a cada início
# (sem migração nova, o migrate não faz nada). A porta vem do Render em $PORT.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 60"]
