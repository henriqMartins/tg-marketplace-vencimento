"""
Grupo J (etapa 15): o código de retirada passa a ser do PEDIDO (uma pessoa + uma loja).

Ordem:
  1. liga a extensão btree_gist (a restrição de exclusão precisa dela);
  2. cria a tabela Pedido e a coluna Reserva.pedido_retirada, ainda opcional;
  3. MIGRAÇÃO SEM PERDA: cada reserva que já existe vira um pedido de 1 item, com o
     mesmo cliente, loja, código e hora (decidido em docs/pedido.md, seção 3);
  4. a coluna vira obrigatória;
  5. troca a trava do código: de "única entre as reservas ativas da loja" para
     "única entre os pedidos ativos da loja" (restrição de exclusão).
"""
import django.contrib.postgres.constraints
import django.db.models.deletion
from django.conf import settings
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations, models


def reservas_viram_pedidos(apps, schema_editor):
    Pedido = apps.get_model("ofertas", "Pedido")
    Reserva = apps.get_model("ofertas", "Reserva")
    for reserva in Reserva.objects.filter(pedido_retirada__isnull=True).iterator():
        pedido = Pedido.objects.create(cliente_id=reserva.consumidor_id, loja_id=reserva.loja_id,
                                       codigo=reserva.codigo, criado_em=reserva.criada_em)
        reserva.pedido_retirada_id = pedido.id
        reserva.save(update_fields=["pedido_retirada"])


def pedidos_somem(apps, schema_editor):
    """Volta: solta as reservas dos pedidos (a tabela é apagada no passo seguinte)."""
    apps.get_model("ofertas", "Reserva").objects.update(pedido_retirada=None)


class Migration(migrations.Migration):

    dependencies = [
        ('ofertas', '0005_loja_parceria'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        BtreeGistExtension(),
        migrations.CreateModel(
            name='Pedido',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=6)),
                ('criado_em', models.DateTimeField()),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='pedidos', to=settings.AUTH_USER_MODEL)),
                ('loja', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='pedidos', to='ofertas.loja')),
            ],
            options={
                'constraints': [models.CheckConstraint(condition=models.Q(('codigo__regex', '^[0-9]{6}$')), name='pedido_codigo_6_digitos')],
            },
        ),
        migrations.AddField(
            model_name='reserva',
            name='pedido_retirada',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='itens', to='ofertas.pedido'),
        ),
        migrations.RunPython(reservas_viram_pedidos, pedidos_somem),
        migrations.AlterField(
            model_name='reserva',
            name='pedido_retirada',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='itens', to='ofertas.pedido'),
        ),
        migrations.RemoveConstraint(
            model_name='reserva',
            name='reserva_codigo_unico_por_loja_entre_ativas',
        ),
        migrations.AddConstraint(
            model_name='reserva',
            constraint=django.contrib.postgres.constraints.ExclusionConstraint(condition=models.Q(('estado', 'reservada')), expressions=[('loja', '='), ('codigo', '='), ('pedido_retirada', '<>')], name='reserva_codigo_unico_por_loja_entre_pedidos_ativos'),
        ),
    ]
