# Assistente de Chat de Orcamentos (Google Drive + Groq)

Assistente de chat que localiza documentos PDF de clientes em uma pasta do Google Drive,
le o conteudo, e responde perguntas usando a IA da Groq. Exibe o PDF do cliente em uma
tela dividida (chat de um lado, visualizador do outro) e mantem o cliente selecionado em
contexto ate que outro cliente seja solicitado.

## Fluxo

Google Drive API -> download do PDF -> pdf-parse -> texto -> IA (Groq)

## Requisitos de credenciais

### 1. Groq API Key
- Crie em https://console.groq.com/keys
- Defina na variavel `GROQ_API_KEY`

### 2. Google Drive (Service Account)
1. Acesse https://console.cloud.google.com
2. Crie um projeto (ou use um existente)
3. Ative a **Google Drive API** em "APIs e servicos > Biblioteca"
4. Crie uma **Conta de Servico** em "APIs e servicos > Credenciais"
5. Gere uma **chave JSON** para essa conta de servico e faca o download
6. **Compartilhe a pasta do Google Drive** com o e-mail da conta de servico
   (o campo `client_email` do JSON), com permissao de **Leitor**
7. Copie todo o conteudo do arquivo JSON para a variavel `GOOGLE_SERVICE_ACCOUNT_JSON`
   (em uma unica linha; o JSON inteiro como string)

### 3. Pasta do Drive
- A pasta padrao ja esta configurada: `GOOGLE_DRIVE_FOLDER_ID=1ULRe_-U-3bZ6vtP-QRJdjUd27AEdFkBx`

## Variaveis de ambiente

| Variavel | Descricao |
| --- | --- |
| `GROQ_API_KEY` | Chave da API da Groq |
| `GROQ_MODEL` | Modelo da Groq (padrao: `llama-3.3-70b-versatile`) |
| `GOOGLE_DRIVE_FOLDER_ID` | ID da pasta do Google Drive com os PDFs |
| `GOOGLE_CREDENTIALS` | Conteudo do JSON da conta de servico |
| `PORT` | Porta do servidor (o Render define automaticamente) |

## Rodar localmente

```bash
npm install
cp .env.example .env
# preencha as variaveis no arquivo .env
npm start
```

Acesse http://localhost:3000

## Deploy no Render

1. Suba este projeto em um repositorio Git (GitHub/GitLab)
2. No Render, crie um novo **Web Service** apontando para o repositorio
3. O arquivo `render.yaml` ja define build e start
4. Em **Environment**, adicione as variaveis:
   - `GROQ_API_KEY`
   - `GOOGLE_CREDENTIALS` (cole o JSON inteiro)
   - `GOOGLE_DRIVE_FOLDER_ID` (ja vem preenchido)
   - `GROQ_MODEL` (opcional)
5. Faca o deploy

## Como usar

- Digite, por exemplo: `quero saber o valor orcado para Vanessa de Araujo`
- O assistente localiza o PDF, confirma se e a cliente certa, abre o documento
  na tela dividida e responde a pergunta.
- Perguntas seguintes (ex.: `qual o valor orcado?`, `tem desconto?`) sao respondidas
  sobre o cliente ja selecionado.
- Para trocar de cliente, basta mencionar outro nome.
- Use o botao "x" no topo para limpar o cliente atual.
