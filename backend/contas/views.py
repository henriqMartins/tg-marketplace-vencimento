"""
Grupo A do contrato (Acesso): criar conta, login, sair e "eu".
Formatos em docs/api/contrato.md.
"""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config.erros import erro
from ofertas.apresentacao import quando
from parceria.servico import interesse_em_aberto

Usuario = get_user_model()
SENHA_MINIMA = 8


def eu(usuario) -> dict:
    """O objeto "Eu" do contrato: quem é a pessoa e com quais lojas tem vínculo."""
    vinculos = usuario.vinculos.select_related("loja").order_by("loja__nome")
    interesse = interesse_em_aberto(usuario)
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "vinculos": [{"loja": {"id": v.loja.id, "nome": v.loja.nome}, "papel": v.papel}
                     for v in vinculos],
        # Grupo I (parceria): A4 mostra "Equipe da plataforma" e o estado de "Tenho um mercado".
        "plataforma": usuario.is_staff,
        "interesse": ({"id": interesse.id, "estado": interesse.estado,
                       "criado_em": quando(interesse.criado_em)} if interesse else None),
    }


class CriarConta(APIView):
    """POST /api/auth/conta {nome, email, senha, aceite_termos} -> 201 {token, usuario}."""
    authentication_classes = []          # rota aberta: quem cria conta ainda não tem crachá
    permission_classes = [AllowAny]

    def post(self, request):
        nome = str(request.data.get("nome") or "").strip()
        email = str(request.data.get("email") or "").strip().lower()
        senha = str(request.data.get("senha") or "")

        if not nome:
            return erro(400, "Informe seu nome.", "sem_nome")
        try:
            validate_email(email)
        except ValidationError:
            return erro(400, "Confira o e-mail.", "email_invalido")
        if len(senha) < SENHA_MINIMA:
            return erro(400, f"A senha precisa ter pelo menos {SENHA_MINIMA} caracteres.",
                        "senha_curta")
        if request.data.get("aceite_termos") is not True:
            return erro(400, "Aceite os termos de uso para continuar.", "termos")
        if Usuario.objects.filter(email__iexact=email).exists():
            return erro(400, "Já existe uma conta com esse e-mail.", "email_em_uso")

        try:
            with transaction.atomic():
                # create_user guarda só o "resumo" (hash) da senha, nunca o texto.
                usuario = Usuario.objects.create_user(
                    username=email, email=email, password=senha, nome=nome)
        except IntegrityError:           # duas contas iguais criadas no mesmo instante
            return erro(400, "Já existe uma conta com esse e-mail.", "email_em_uso")
        token = Token.objects.create(user=usuario)
        return Response({"token": token.key, "usuario": eu(usuario)}, status=201)


class Login(APIView):
    """POST /api/auth/login {email, senha} -> 200 {token, usuario}."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email") or "").strip()
        senha = str(request.data.get("senha") or "")
        usuario = Usuario.objects.filter(email__iexact=email).first()
        # Mesma resposta para e-mail inexistente e senha errada: não revela quem tem conta.
        if usuario is None or not usuario.is_active or not usuario.check_password(senha):
            return erro(400, "E-mail ou senha incorretos. Confira e tente de novo.",
                        "credenciais_invalidas")
        token, _ = Token.objects.get_or_create(user=usuario)
        return Response({"token": token.key, "usuario": eu(usuario)})


class Sair(APIView):
    """POST /api/auth/sair -> 204. Apaga o crachá: ele deixa de valer."""

    def post(self, request):
        request.auth.delete()
        return Response(status=204)


class Eu(APIView):
    """GET /api/eu -> 200 Eu."""

    def get(self, request):
        return Response(eu(request.user))
