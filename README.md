# 🧵 Bastidor APP

Um sistema elegante e intuitivo para bordadeiras gerenciarem suas encomendas, prazos e finanças com leveza.

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="Bastidor Banner" width="100%" />
</div>

## ✨ Funcionalidades

- **Gestão de Encomendas**: Cadastro detalhado de clientes, peças e prazos.
- **Autenticação Segura**: Login e cadastro via Supabase Auth.
- **Persistência na Nuvem**: Seus dados sincronizados em tempo real com o banco de dados Supabase.
- **Resumo Financeiro**: Visualização clara de valores recebidos e pendentes por mês.
- **Calendário de Prazos**: Acompanhamento visual de entregas com alertas de urgência.
- **Relatórios PDF**: Geração de relatórios financeiros detalhados para compartilhamento ou impressão.
- **Interface Mobile-First**: Menu lateral intuitivo e design responsivo inspirado na estética do bordado manual.

## 🚀 Tecnologias

- **Frontend**: React 19 + TypeScript
- **Estilização**: Tailwind CSS + Motion (Animações)
- **Ícones**: Lucide React
- **Backend & Auth**: Supabase
- **PDF**: jsPDF

## 💻 Como Rodar Localmente

1. **Clonar o repositório:**
   ```bash
   git clone <url-do-seu-repositorio>
   cd bastidor-app
   ```

2. **Instalar dependências:**
   ```bash
   npm install
   ```

3. **Configurar variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto com suas credenciais do Supabase:
   ```env
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_anon_key_do_supabase
   ```

4. **Executar o projeto:**
   ```bash
   npm run dev
   ```

## 📄 Licença

Este projeto está sob a licença Apache-2.0.

---
<div align="center">
  Feito com amor por bordadeiras ✦
</div>
