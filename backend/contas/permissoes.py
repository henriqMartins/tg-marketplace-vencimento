"""
Porteiros por papel (permissões do DRF), aceitos em 05/11/2026:
  - EhDaLoja:      funcionário OU responsável da loja da rota (telas L1–L13);
  - EhResponsavel: só o responsável da loja da rota (L14, G1–G6);
  - EhEquipe:      só a equipe da plataforma (is_staff), rotas /api/plataforma/... (P1–P3).

As rotas de loja têm o id da loja no endereço: /api/lojas/<loja_id>/...
O DRF chama has_permission() ANTES da rota; devolver False = barrado.
Sem crachá -> 401 (o DRF decide sozinho); com crachá e False -> 403.
"""
from typing import Optional

from rest_framework.permissions import BasePermission

from ofertas.models import Papel, Vinculo


def papel_na_loja(usuario, loja_id) -> Optional[str]:
    """O papel da pessoa nesta loja ("responsavel" / "funcionario"), ou None se não tem vínculo."""
    vinculo = Vinculo.objects.filter(usuario=usuario, loja_id=loja_id).first()
    return vinculo.papel if vinculo else None


class EhDaLoja(BasePermission):
    message = "Você não tem acesso a esta loja."

    # 📖 ESTUDAR: compare com o EhResponsavel abaixo — só a última linha muda
    # ("tem ALGUM papel" × "tem ESTE papel").
    def has_permission(self, request, view):
        if not request.user.is_authenticated:     # sem crachá: barra (o DRF responde 401)
            return False
        loja_id = view.kwargs.get("loja_id")      # o <loja_id> do endereço da rota
        # Qualquer papel serve: "responsavel" ou "funcionario". Sem vínculo = None = barra.
        return papel_na_loja(request.user, loja_id) is not None


class EhResponsavel(BasePermission):
    message = "Só o responsável da loja pode fazer isso."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        loja_id = view.kwargs.get("loja_id")
        return papel_na_loja(request.user, loja_id) == Papel.RESPONSAVEL


class EhEquipe(BasePermission):
    """
    Equipe da plataforma = conta com is_staff (docs/parceria.md; sem tabela nova).
    is_staff é do próprio Django: só nasce pelo createsuperuser (do PC, contra o banco)
    ou pelo popular_demo. Nenhuma rota da API liga essa marca.
    """
    message = "Só a equipe da plataforma pode fazer isso."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_staff)
