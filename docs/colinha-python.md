# Colinha de Python — só o que aparece no TG

Exemplos tirados do próprio projeto. Leia de cima para baixo uma vez; depois use como consulta.

## 1. Recuo (indentação) = "o que está dentro"

O Python não usa `{ }` nem `;`. Quem diz "esta linha pertence a este bloco" são **4 espaços a mais**.

```python
if reserva is None:          # linha que abre bloco termina com ":"
    return None              # 4 espaços a mais = dentro do if
return reserva               # voltou ao alinhamento = fora do if
```

## 2. Variável = caixa com etiqueta

```python
livre = 7                    # guarda 7 na caixa "livre"
linha = _travar(oferta_id)   # leia da DIREITA p/ a ESQUERDA: executa _travar(...) e guarda o resultado em "linha"
```

## 3. Função = receita (com ingredientes)

```python
def horas(dt):                     # def NOME(ingredientes):
    return dt.timestamp() / 3600   # return = "o que a receita devolve"

h = horas(agora)                   # CHAMAR a receita: nome + ( ingredientes )
```

- Os **parâmetros** (`dt`) só existem dentro da função; quem chama entrega o valor.
- `_nome` (com sublinhado na frente) = convenção para "uso interno deste arquivo".
- Verbo costuma ser função (`reservar`, `travar`); substantivo costuma ser caixa (`reserva`, `linha`).

## 4. Ponto = "de dentro de"

```python
oferta.reservar(3, h)        # a ação "reservar" DA oferta (método)
reserva.id                   # o campo "id" DA reserva (atributo)
Reserva.objects.create(...)  # da tabela Reserva → seu gerenciador → criar linha
```

Com `( )` no fim = **ação** (executa). Sem `( )` = **valor** (só lê).

## 5. Ingredientes com nome

```python
Recusa.objects.create(oferta=linha, consumidor=consumidor, pedido=pedido)
#                     ^ coluna    ^ caixa com o valor
```

À **esquerda** do `=` fica o nome que a função espera; à **direita**, o valor. Igualdade de nomes é coincidência.

## 6. Decisões e repetições

```python
if valor < 0:                         # se
    raise ErroDominio("negativo")     #   puxa o freio de mão (erro)
elif valor == 0:                      # senão, se
    ...
else:                                 # senão
    ...

for r in reservas_ativas:             # "para CADA reserva r da lista"
    total = total + r.quantidade
```

- Comparar: `==` igual · `!=` diferente · `<` `<=` `>` `>=`
- Juntar condições: `a < 0 or b < 0` (cada lado **completo**), `and`, `not`
- `is None` = "está vazio / não veio nada"

## 7. Coleções

```python
ids = [1, 2, 3]                      # lista: em ordem, aceita repetidos
set(ids)                             # conjunto: sem repetidos → {1, 2, 3}
dados = {"livre": 7, "perda": 0}     # dicionário: etiqueta → valor
dados["livre"]                       # lê o valor da etiqueta → 7
len(ids)                             # tamanho → 3
sum(r.quantidade for r in reservas)  # soma de um campo de cada item
```

## 8. Texto com valor dentro (f-string)

```python
f"livre negativo: {livre}"           # → "livre negativo: -1"
```

## 9. `with` = "abre, usa, fecha sozinho"

```python
with transaction.atomic():           # abre a transação "tudo ou nada"
    ...                              # tudo aqui dentro vale junto
                                     # ao sair do bloco: confirma (ou desfaz, se deu erro)
```

## 10. Django: o mínimo

| Escrevo | Significa |
|---|---|
| `class Oferta(models.Model):` | uma tabela |
| `livre = models.IntegerField()` | uma coluna |
| `models.ForeignKey(Loja, ...)` | coluna que aponta para uma linha de outra tabela |
| `Oferta.objects.create(...)` | grava uma linha nova |
| `Oferta.objects.get(pk=7)` | busca exatamente uma linha (erro se não achar) |
| `Reserva.objects.filter(loja_id=1, estado="reservada")` | busca várias (pode vir vazio) |
| `.first()` · `.exists()` · `.count()` | primeira ou `None` · tem algum? · quantos |
| `Oferta.objects.select_for_update().get(pk=7)` | busca **e trava** a linha até o fim da transação |
| `Q(livre__gte=0)` | condição: `livre >= 0` (`__gt` >, `__lt` <, `__lte` <=, `__in` está na lista) |
| `linha.save()` | grava as mudanças da linha |

## 11. Ler um erro

Leia a **última linha** primeiro (o tipo e a mensagem) e depois suba até achar um arquivo **do projeto** (não da `.venv`): ali está a linha que causou.

| Erro | Quer dizer |
|---|---|
| `SyntaxError` | erro de gramática: o Python nem leu o arquivo |
| `NameError: name 'x' is not defined` | usou um nome que não existe ali (erro de digitação? fora do bloco?) |
| `AttributeError: ... has no attribute 'x'` | pediu `.x` de algo que não tem `x` |
| `IntegrityError` | o banco recusou (uma trava/constraint) |
| `ErroDominio` | uma regra do negócio recusou |
