"""
Dados de DEMONSTRAÇÃO para gravar o vídeo: python manage.py popular_demo

Tudo é FICTÍCIO (lojas, pessoas, e-mails @example.com, domínio reservado para
exemplos). Senha de todas as contas: demo1234.

As datas são relativas a HOJE, para os dados sempre parecerem "frescos". E nada
é gravado direto na tabela: cada passo chama o SERVIÇO de verdade (registrar
lote, adiar, publicar, reservar, cancelar, retirar). Assim a fita, o grupo, o
fim da oferta e o estoque saem pelas mesmas regras do sistema — o vídeo mostra o
comportamento real, não números escritos à mão.

Rodar de novo não duplica: se a conta do Carlos já existe, o comando não faz nada.
Para recomeçar do zero no banco local: python manage.py flush, depois popular_demo.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from ofertas import servico, servico_lotes
from ofertas.fita import fita
from ofertas.models import Loja, Papel, Produto, Vinculo

SENHA = "demo1234"
CARLOS = "carlos@example.com"


def _mesma_fita(a: date, b: date) -> bool:
    return (fita(a)["cor"], fita(a)["ano"]) == (fita(b)["cor"], fita(b)["ano"])


class Command(BaseCommand):
    help = "Cria lojas, equipe, produtos, lotes, ofertas e reservas FICTÍCIOS para a demonstração."

    def handle(self, *args, **opcoes):
        Usuario = get_user_model()
        if Usuario.objects.filter(email__iexact=CARLOS).exists():
            self.stdout.write("Dados de demonstração já existem; nada a fazer.")
            return
        with transaction.atomic():          # ou cria tudo, ou nada
            self.popular(timezone.now())
        self.stdout.write(self.style.SUCCESS(
            f"Pronto. Entre com {CARLOS} (responsável), juliana@example.com (funcionária) ou "
            f"ana@example.com (consumidora). Senha de todos: {SENHA}"))

    # ------------------------------------------------------------ ajudantes

    def pessoa(self, email, nome):
        return get_user_model().objects.create_user(username=email, email=email,
                                                    password=SENHA, nome=nome)

    def produto(self, loja, nome, categoria):
        return Produto.objects.create(loja=loja, nome=nome, categoria=categoria)

    def lote(self, produto, validade, quantidade, autor, agora):
        _, grupo, _, _ = servico_lotes.registrar_lote(produto.id, validade, quantidade,
                                                      autor, agora=agora)
        return grupo

    def publicar(self, grupo, separado, preco, desconto, janela, agora):
        return servico_lotes.publicar(grupo.id, separado, Decimal(preco), desconto, janela,
                                      agora=agora)

    # ------------------------------------------------------------ cenário

    def popular(self, agora):
        hoje = timezone.localdate(agora)
        dia = lambda n: hoje + timedelta(days=n)
        ontem, anteontem = agora - timedelta(days=1), agora - timedelta(days=2)
        horas_atras = lambda h: agora - timedelta(hours=h)

        # Pessoas
        carlos = self.pessoa(CARLOS, "Carlos Lima")
        juliana = self.pessoa("juliana@example.com", "Juliana Prado")
        ana = self.pessoa("ana@example.com", "Ana Souza")
        bruno = self.pessoa("bruno@example.com", "Bruno Costa")
        rosa = self.pessoa("rosa@example.com", "Rosa Mendes")

        # Lojas (coordenadas de exemplo; a outra fica a ~3 km, para a vitrine ordenar)
        vila = Loja.objects.create(nome="Mercadinho Vila Nova",
                                   endereco="Rua das Palmeiras, 410 · Boa Vista",
                                   latitude=Decimal("-20.811300"), longitude=Decimal("-49.375800"))
        emporio = Loja.objects.create(nome="Empório São Jorge", endereco="Av. das Acácias, 1200",
                                      latitude=Decimal("-20.835000"), longitude=Decimal("-49.392000"))
        Vinculo.objects.create(usuario=carlos, loja=vila, papel=Papel.RESPONSAVEL)
        Vinculo.objects.create(usuario=juliana, loja=vila, papel=Papel.FUNCIONARIO)
        Vinculo.objects.create(usuario=rosa, loja=emporio, papel=Papel.RESPONSAVEL)

        # 1. Iogurte: em oferta, com uma reserva ativa, uma retirada e uma cancelada.
        iogurte = self.produto(vila, "Iogurte natural 170 g", "laticinios")
        g = self.lote(iogurte, dia(4), 24, juliana, anteontem)
        oferta = self.publicar(g, 12, "4.49", 30, 4, ontem)
        # (os eventos de uma oferta vão sempre na ordem do tempo, como na vida real)
        r = servico.reservar(oferta.id, bruno, 3, agora=horas_atras(3))
        servico.retirar(vila.id, r.codigo, juliana, agora=horas_atras(2))
        r = servico.reservar(oferta.id, bruno, 1, agora=horas_atras(2))
        servico.cancelar(r.id, agora=horas_atras(1))
        servico.reservar(oferta.id, ana, 2, agora=horas_atras(1))

        # 2. Leite: DOIS lotes na mesma fita viram UM grupo (referência = data mais próxima).
        leite = self.produto(vila, "Leite integral 1 L", "leite")
        primeira = dia(6)
        segunda = dia(8) if _mesma_fita(primeira, dia(8)) else dia(4)   # longe da virada do bimestre
        self.lote(leite, segunda, 12, juliana, anteontem)
        g = self.lote(leite, primeira, 30, carlos, anteontem)
        oferta = self.publicar(g, 20, "5.29", 40, 8, ontem)
        servico.reservar(oferta.id, bruno, 4, agora=horas_atras(1))

        # 3. Requeijão: reserva PARCIAL (pediu 3, só havia 2) e uma reserva que VENCEU
        #    (a janela de 4 h passou; expira sozinha na próxima leitura — sem worker).
        requeijao = self.produto(vila, "Requeijão cremoso 200 g", "laticinios")
        g = self.lote(requeijao, dia(5), 6, juliana, anteontem)
        oferta = self.publicar(g, 4, "7.90", 30, 4, ontem)
        servico.reservar(oferta.id, bruno, 2, agora=horas_atras(6))     # vence 2 h atrás
        servico.reservar(oferta.id, ana, 3, agora=horas_atras(3))       # leva só 2 (ainda ativa)

        # 4. Pão de forma: esgotou; quem chegou depois foi RECUSADO (comprador bloqueado).
        pao = self.produto(vila, "Pão de forma 500 g", "mercearia")
        g = self.lote(pao, dia(3), 2, juliana, anteontem)
        oferta = self.publicar(g, 2, "8.99", 50, 2, ontem)
        r = servico.reservar(oferta.id, ana, 2, agora=horas_atras(4))
        servico.retirar(vila.id, r.codigo, carlos, agora=horas_atras(3))
        servico.reservar(oferta.id, bruno, 1, agora=horas_atras(2))     # livre 0 -> recusa

        # 5. Avisos para conferir hoje (L5/L6): presunto em "conferir"; doce de leite adiado.
        presunto = self.produto(vila, "Presunto fatiado 200 g", "frios")
        self.lote(presunto, dia(7), 10, juliana, agora)
        doce = self.produto(vila, "Doce de leite 400 g", "doces")
        g = self.lote(doce, dia(9), 8, juliana, agora)
        servico_lotes.adiar(g.id, dia(2), agora=agora)

        # 6. Fitas de outras cores ainda aguardando o aviso, e uma COLISÃO de ciclo:
        #    feijão com a mesma cor em anos diferentes (duas fitas iguais na gôndola).
        feijao = self.produto(vila, "Feijão carioca 1 kg", "mercearia")
        validade = dia(40)
        self.lote(feijao, validade, 15, juliana, agora)
        self.lote(feijao, date(validade.year + 1, validade.month, min(validade.day, 28)),
                  20, juliana, agora)
        milho = self.produto(vila, "Milho verde em lata 200 g", "enlatados")
        self.lote(milho, dia(90), 24, juliana, agora)
        self.lote(self.produto(vila, "Molho de tomate 340 g", "enlatados"), dia(150), 18,
                  carlos, agora)

        # 7. A outra loja, com uma oferta (a vitrine mostra as duas, por distância).
        queijo = self.produto(emporio, "Queijo minas frescal 500 g", "frios")
        g = self.lote(queijo, dia(5), 10, rosa, anteontem)
        self.publicar(g, 6, "24.90", 40, 12, ontem)
