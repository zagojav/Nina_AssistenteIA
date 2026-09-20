# Nina

PWA em Next.js + Firebase + Groq onde residentes de uma casa de repouso conversam com
uma assistente (Nina) por texto ou voz, e a equipe de curadoria recebe
relatórios em PDF com **indícios comportamentais observados**, nunca
diagnósticos.

> **Regra que sustenta o produto:** a IA não decide o que é relevante. Ela
> compara a transcrição com uma base de padrões fixa, curada por humanos, com
> fonte científica por padrão. O que não casa com um padrão da base é
> descartado.

---

## Como funciona

```
RESIDENTE (tablet)
  nome + PIN  ->  bcrypt valida, cookie de sessao, tablet fica vinculado
                  (dai em diante entra sem PIN)

  conversa    ->  Nina responde (gpt-oss-120b, esforco baixo)
                  categoria de foco escolhida no servidor
                  3 a 5 trocas, despedida automatica

  ao encerrar
      |
      v
SERVIDOR
  transcricao COMPLETA + padroes de referencia ativos
      |
      +-> analise (gpt-oss-120b) -> indicios
      |      so os que casam com um padrao da base; o resto e descartado
      |
      +-> relatorio (gpt-oss-120b) -> PDF -> Storage privado
      |
      +-> resumo curto -> contexto da proxima conversa
                          (nunca entra na analise)
      |
      v
CURADOR (painel)
  ler relatorio, baixar PDF, enviar por e-mail ou WhatsApp
```

A transcricao nunca e resumida antes da analise. O resumo existe so para a
Nina retomar o papo na conversa seguinte.

## Stack e decisões

| Decisão | Por quê |
|---|---|
| Rotas de API do Next em vez de Cloud Functions para o caminho principal | A chave da Groq e o acesso ao Storage já vivem no servidor do app; ter dois motores de indícios significaria manter a mesma lógica em dois lugares. |
| Cloud Functions (`functions/`) só para o agendamento | Consolidados e retenção disparam as rotas protegidas por segredo. Em deploy na Vercel, `vercel.json` já faz isso e o pacote é dispensável. |
| Client nunca fala com o Firestore | Toda leitura de dado sensível passa por rota que valida o ID token e grava log de acesso. As Firestore Rules são a segunda camada, não a única. |
| PDFs privados no Storage | O curador baixa por rota autenticada; o compartilhamento pontual usa URL assinada de 30 minutos. |
| `openai/gpt-oss-120b` nos três usos, com esforço de raciocínio diferente | O modelo menor (`gpt-oss-20b`) falhou em 5 de 12 chamadas com `tool_use_failed`. A conversa roda em esforço baixo (rápida e barata), a análise e o relatório em esforço padrão. |
| Saída da análise em modo JSON + validação com zod | O modo JSON garante JSON sintático, não o contrato. O zod é a trava: saída fora do formato vira zero indício, nunca indício inventado. |
| Sem modo escuro | O público principal é idoso e muitos tablets ficam em modo escuro permanente; uma paleta só garante o contraste. |

---

## Configuração

### 1. Groq

Crie uma chave em <https://console.groq.com/keys> e coloque em `GROQ_API_KEY`.
Os dois modelos usados estão em `src/lib/groq.ts`:

- `openai/gpt-oss-120b` com esforço baixo: conversa da Nina
- `openai/gpt-oss-120b` com esforço padrão: análise de indícios e relatório

O catálogo de modelos varia por conta. Para ver o da sua chave:

```bash
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

### 2. Firebase

Crie o projeto e habilite:

- **Firestore** (modo produção)
- **Authentication** → provedor E-mail/senha (login do curador)
- **Storage** (os PDFs ficam privados; as regras bloqueiam acesso de client)

Gere uma chave de conta de serviço em *Configurações do projeto → Contas de
serviço → Gerar nova chave privada*.

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha tudo. Para o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. Regras e índices

```bash
npm i -g firebase-tools
firebase login
firebase use SEU_PROJETO
firebase deploy --only firestore:rules,firestore:indexes,storage
```

O fluxo do residente (login, conversa, análise, relatório) **não depende de
índice composto**, isso foi deliberado, porque índice faltando derrubava a
tela que o idoso usa sozinho. Os quatro índices restantes servem às listagens
da área do curador; sem eles, essas telas mostram um aviso com o link de
criação em vez de um erro genérico.

### 5. Provisionamento inicial

Com `SEED_SECRET` definido, rode uma vez:

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "x-seed-secret: $SEED_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "instituicao": { "nome": "Casa Bem Viver", "endereco": "Rua X, 100" },
    "curador": { "nome": "Ana", "email": "ana@casa.com", "senha": "trocar-depois", "cargo": "Enfermeira" },
    "idosoDemo": { "nome": "Joao", "sobrenome": "Souza", "pin": "1234" }
  }'
```

Isso semeia a base científica global, o catálogo de jogos, a instituição, o
curador e um residente de teste. Copie o `instituicaoId` devolvido para
`INSTITUICAO_ID` no `.env.local`.

O seed é repetível: rodar de novo não duplica nada. O residente é criado
mesmo que o Firebase Auth ainda não esteja ativo, ele entra por PIN e não
depende de Auth. Só o curador depende.

Para adicionar curadores depois (ou corrigir uma senha):

```bash
curl -X POST http://localhost:3000/api/seed/curador \
  -H "x-seed-secret: $SEED_SECRET" -H "content-type: application/json" \
  -d '{"nome":"Ana","email":"ana@casa.com","senha":"...","cargo":"Enfermeira"}'
```

**Remova o `SEED_SECRET`** do ambiente quando terminar de provisionar.

### 6. Rodar

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
```

---

## Base de padrões de referência

`padroesReferencia` é uma coleção **global**, semeada por
`src/lib/padroesReferencia.ts` e **não gerada por IA**. Cada padrão tem:

```
tipo                  ex.: "repeticao_curta"
descricaoPadrao       o que caracteriza o padrão
fonteReferencia       autor, obra, ano (e link quando público)
categoriaRelacionada  alimentacao | sono | memoria_recente | ...
ativo                 desligar um padrão o tira da análise na hora
```

A semente traz 15 padrões apoiados em Alzheimer's Association (10 Early Signs),
DSM-5-TR, MMSE (Folstein et al., 1975), Cornell Scale (Alexopoulos et al.,
1988), PSQI (Buysse et al., 1989), MNA (Guigoz et al., 1996), Katz ADL (1963) e
OMS.

**Revise esta lista com a equipe clínica antes de usar em produção.** É ela que
define o que o sistema é capaz de observar, nenhum item é critério
diagnóstico, e nenhum, isoladamente, significa doença.

---

## Jogos cognitivos

Os três jogos replicam os três domínios treinados no **ACTIVE** (Advanced
Cognitive Training for Independent and Vital Elderly), o maior ensaio
randomizado de treino cognitivo em idosos, com 2.832 participantes de 65 a 94
anos e acompanhamento de 20 anos.

| Jogo | Domínio | Paradigma replicado |
|---|---|---|
| **Olhar rápido** | Velocidade de processamento | Useful Field of View (UFOV): identificar a figura central e localizar o alvo periférico, com o tempo de exibição encurtando a cada acerto |
| **Lista de compras** | Memória episódica verbal | Lista agrupada por categoria com a estratégia de organização ensinada, depois reconhecimento entre distratores |
| **Qual vem depois?** | Raciocínio indutivo | Completar séries com padrão serial (números, letras, formas), geradas a cada partida |

O braço de velocidade de processamento foi o que mostrou os efeitos mais
duradouros: menor risco de queda em dez anos e menor incidência de demência
em dez e vinte anos de seguimento.

Referências: Ball K et al., *JAMA* 2002;288(18):2271-81 · Rebok GW et al.,
*J Am Geriatr Soc* 2014;62(1):16-24 · Edwards JD et al., *Alzheimers Dement
(N Y)* 2017;3(4):603-11.

O tempo de exibição do Olhar rápido é adaptativo: encurta 25% a cada acerto e
alarga 40% a cada erro, então o exercício se ajusta ao ritmo da pessoa em vez
de ter níveis fixos. Nenhum dos três alimenta o motor de indícios, a
performance fica isolada em `sessoesJogo`, como especificado.

## Quiosque: o que dá e o que não dá

`src/components/GuardaKiosk.tsx` aplica: tela cheia no primeiro toque, gesto de
voltar interceptado (`history.pushState` + `popstate`), bloqueio ao perder o
foco com desbloqueio por **senha do curador** (nunca o PIN do próprio
residente), e CSS que desliga seleção, zoom por duplo toque e menu de
long-press.

- **Android:** com o PWA instalado e a Fixação de Tela ligada, chega perto de um
  quiosque real.
- **iOS:** o swipe para sair do app **não é bloqueável**, o Safari não expõe
  isso. A contenção possível é a tela de senha ao voltar. Avise a instituição.

---

## LGPD

Dado de conversa de residente é **dado pessoal sensível de saúde** (art. 11).
O que o sistema implementa:

- PIN sempre com bcrypt (custo 12), nunca em texto puro, nunca devolvido ao client
- Escopo por instituição em toda rota admin, mais Firestore Rules como segunda camada
- `logsAcesso` gravando visualização, download, edição, envio e exclusão
- Campo `consentimentoAssinado` no cadastro (o termo em si fica fora do sistema)
- Exclusão integral a pedido do responsável (`DELETE /api/admin/idosos/[id]`):
  apaga conversas, mensagens, indícios, relatórios e PDFs; o log da exclusão
  permanece como prova de atendimento
- Política de retenção automática em `/api/cron/retencao`, com prazos por
  variável de ambiente
- PDFs privados, sem URL pública; compartilhamento por link assinado de 30 min
- `robots.txt` e `robots: noindex` bloqueando indexação

**Pendências que dependem da instituição, não do código:** termo de
consentimento assinado antes do primeiro uso; definição dos prazos de retenção
com o jurídico; e anonimização antes de usar conversa real em teste.

---

## Rotinas agendadas

| Rota | Quando | O que faz |
|---|---|---|
| `/api/cron/consolidar?tipo=diario` | 23h | Consolidado do dia, por residente com conversa na janela |
| `/api/cron/consolidar?tipo=semanal` | domingo 23h | Consolidado dos 7 dias |
| `/api/cron/retencao` | 4h30 | Aplica a política de retenção |

Autenticadas por `CRON_SECRET` (`Authorization: Bearer` ou `x-cron-secret`).
Use **um** agendador: `vercel.json` **ou** `functions/`, os dois juntos geram
relatório duplicado.

---

## Mapa do código

```
src/lib/
  types.ts              modelo de dados e caminhos do Firestore
  groq.ts               client da Groq e escolha de modelo
  prompts.ts            system prompt da Nina, da análise e do relatório
  padroesReferencia.ts  base científica (semente)
  conversa.ts           rodízio de categorias, turno da Nina, fim de conversa
  analise.ts            transcrição × base de padrões (JSON validado por zod)
  relatorio.ts          redação, PDF, Storage, link temporário
  pdf.ts                gerador de PDF (pdf-lib)
  session.ts            cookie assinado do residente (jose)
  auth.ts               ID token do curador + escopo por instituição
  logs.ts               trilha de auditoria

src/app/api/
  idoso/                login por PIN/dispositivo, sessão, preferência de modo
  conversa/             iniciar, mensagem, finalizar (dispara o pipeline)
  jogos/                catálogo e gravação de partidas
  admin/                área do curador (tudo exige ID token)
  cron/                 consolidados e retenção
  seed/                 provisionamento inicial

src/components/
  LoginIdoso, Conversa, GuardaKiosk
  jogos/                memória de cartas, sequência numérica, associação
  curador/              painel, ficha do residente, relatório
```

---

## Estado atual

**Verificado com credenciais reais:**

- Login do curador (`guilherme.rezendezago@gmail.com`) e todas as rotas admin
- Login do residente por PIN, com e sem acento, e vínculo de tablet
- Conversa completa com rodízio de categoria, análise com 4 indícios casando
  com a base, relatório gravado e PDF conferido visualmente
- As quatro rotas que antes davam `FAILED_PRECONDITION` respondem 200
- Catálogo de jogos servindo os três novos, e partida gravada em `sessoesJogo`
- Todas as páginas respondem: `/`, `/conversa`, `/jogos`, os três jogos,
  `/curador` e 404 em rota inexistente

**Nenhum índice composto é necessário.** As listagens filtram por igualdade
(índice automático de campo único) e ordenam em memória com teto de leitura -
ver `src/lib/consultas.ts`. `firestore.indexes.json` está vazio de propósito.

**Não verificado:** aparência das telas (não há navegador neste ambiente, a
verificação foi por código e por HTTP), envio de relatório por e-mail (exige
`RESEND_API_KEY`) e as rotinas agendadas.

**Opcional:** criar o bucket em Console → Storage faz o PDF ser arquivado além
de gerado sob demanda.

**Decisão em aberto:** a Nina não afirma nem corrige data, dia da semana ou
qualquer fato que não tenha como saber, ela devolve a pergunta. Se a
instituição preferir que ela saiba a data real, é uma linha no `promptNina`
mais a data no contexto.

**Fora de escopo:** performance dos jogos não alimenta o motor de indícios; o
freio de tentativas de PIN é por instância (`src/lib/throttle.ts`) e precisa
virar contador compartilhado antes de escalar horizontalmente.
