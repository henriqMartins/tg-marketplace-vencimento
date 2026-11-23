"""
Entrada de mercados por parceria (etapa 14, grupo I; regra em docs/parceria.md).

Duas tabelas:
  - Interesse: o dono pede para entrar ("Tenho um mercado", A6); a equipe acompanha (P1).
  - Convite:   a equipe cadastra a loja (P3) e o sistema gera um link de uso único que
               o dono aceita (A7), virando responsável.

Como em ofertas/models.py, as TRAVAS DO BANCO são a segunda tranca: o serviço confere
antes, mas é a restrição única que segura dois pedidos chegando no mesmo instante.
"""
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class EstadoInteresse(models.TextChoices):
    NOVO = "novo"
    EM_CONVERSA = "em_conversa"
    VIROU_LOJA = "virou_loja"
    DESCARTADO = "descartado"


EM_ABERTO = [EstadoInteresse.NOVO, EstadoInteresse.EM_CONVERSA]


class Interesse(models.Model):
    pessoa = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="interesses")
    nome_mercado = models.CharField(max_length=120)
    cidade = models.CharField(max_length=120)
    telefone = models.CharField(max_length=20)
    mensagem = models.TextField(blank=True, default="")
    estado = models.CharField(max_length=12, choices=EstadoInteresse.choices,
                              default=EstadoInteresse.NOVO)
    motivo_descarte = models.CharField(max_length=255, null=True, blank=True)
    loja = models.ForeignKey("ofertas.Loja", on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="interesses")
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            # 📖 ESTUDAR: restrição única PARCIAL. "Única" só entre as linhas que passam
            # no filtro (condition): a pessoa pode ter vários interesses descartados, mas
            # só UM em aberto. Dois cliques em "Enviar pedido" ao mesmo tempo → o banco
            # recusa o segundo, mesmo que os dois tenham passado no "if" do serviço.
            models.UniqueConstraint(fields=["pessoa"], condition=Q(estado__in=EM_ABERTO),
                                    name="um_interesse_em_aberto_por_pessoa"),
            models.CheckConstraint(condition=Q(estado__in=EstadoInteresse.values),
                                   name="interesse_estado_valido"),
        ]

    def __str__(self):
        return f"{self.nome_mercado} ({self.estado})"


class EstadoConvite(models.TextChoices):
    # "vencido" não é gravado: é calculado (pendente + expira_em já passou), como o
    # "livre" da vitrine que desconta reservas vencidas ainda não processadas.
    PENDENTE = "pendente"
    ACEITO = "aceito"
    SUBSTITUIDO = "substituido"     # a equipe gerou outro; responde como vencido (17/11/2026)


class Convite(models.Model):
    loja = models.ForeignKey("ofertas.Loja", on_delete=models.CASCADE, related_name="convites")
    email = models.EmailField()
    codigo = models.CharField(max_length=64, unique=True)
    estado = models.CharField(max_length=12, choices=EstadoConvite.choices,
                              default=EstadoConvite.PENDENTE)
    criado_em = models.DateTimeField(default=timezone.now)
    expira_em = models.DateTimeField()
    aceito_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="convites_aceitos")
    aceito_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # No máximo um convite pendente por loja: gerar outro exige antes
            # marcar o anterior como "substituido" (na mesma transação).
            models.UniqueConstraint(fields=["loja"], condition=Q(estado="pendente"),
                                    name="um_convite_pendente_por_loja"),
            models.CheckConstraint(condition=Q(estado__in=EstadoConvite.values),
                                   name="convite_estado_valido"),
        ]

    def vencido(self, agora=None) -> bool:
        agora = agora or timezone.now()
        return self.estado == EstadoConvite.SUBSTITUIDO or (
            self.estado == EstadoConvite.PENDENTE and self.expira_em <= agora)

    def __str__(self):
        return f"Convite {self.loja} → {self.email} ({self.estado})"
