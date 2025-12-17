# ContentSpark ⚡

<div align="center">
<img width="1200" height="475" alt="ContentSpark Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

**AI-Powered Content Idea Generation & Management Platform**

Stop staring at a blank page. Generate, organize, and schedule content ideas effortlessly.

[![Built with React](https://img.shields.io/badge/React-18.x-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)](https://tailwindcss.com/)

</div>

---

## 🎯 Features

### Core Functionality
- **🤖 AI Content Generation**: Powered by Google Gemini AI
- **📅 Content Calendar**: Visual calendar with drag-and-drop scheduling
- **👥 Team Collaboration**: Create teams, invite members, share ideas
- **🎨 Brand Kit**: Define your brand colors, fonts, and style
- **🔔 Smart Notifications**: Get notified when ideas are due
- **📊 Persona Management**: Target specific audiences
- **🌍 Internationalization**: English & Portuguese support

### Technical Highlights
- **Real-time Updates**: Supabase real-time subscriptions
- **Optimistic UI**: Fast, responsive user experience
- **Offline-First**: Client-side caching with automatic sync
- **Secure Authentication**: Supabase Auth with row-level security
- **Serverless Architecture**: n8n workflows for AI processing

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/blbacelar/contentSpark.git
   cd contentSpark
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Google AI
   VITE_GOOGLE_API_KEY=your_gemini_api_key
   
   # n8n Webhook URLs (optional - for AI generation)
   VITE_GENERATE_IDEAS_URL=your_n8n_webhook_url
   VITE_UPDATE_WEBHOOK_URL=your_update_webhook_url
   VITE_DELETE_WEBHOOK_URL=your_delete_webhook_url
   VITE_CREATE_IDEA_WEBHOOK_URL=your_create_webhook_url
   ```

4. **Run database migrations**
   
   Execute the SQL migrations in `supabase/migrations/` through your Supabase dashboard.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:3000`

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e.spec.ts

# Run with UI mode
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed
```

### Test Configuration

1. Create `.env.test` from the example:
   ```bash
   cp .env.test.example .env.test
   ```

2. Fill in your test credentials in `.env.test`

See [tests/README.md](tests/README.md) for detailed testing documentation.

---

## 📁 Project Structure

```
contentSpark/
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   └── dashboard/       # Dashboard-specific components
├── context/             # React context providers
├── hooks/               # Custom React hooks
├── services/            # API services (Supabase, AI)
├── locales/             # i18n translations
├── supabase/            # Database migrations
│   └── migrations/      # SQL migration files
├── tests/               # Playwright E2E tests
│   ├── fixtures/        # Test fixtures
│   └── test-helpers.ts  # Test utilities
└── types.ts             # TypeScript type definitions
```

---

## 🔑 Key Technologies

| Technology | Purpose |
|------------|---------|
| **React** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Styling |
| **Supabase** | Backend (Auth, Database, Storage) |
| **Google Gemini AI** | Content generation |
| **n8n** | Workflow automation |
| **Playwright** | E2E testing |
| **i18next** | Internationalization |
| **date-fns** | Date utilities |
| **@dnd-kit** | Drag and drop |

---

## 🗄️ Database Schema

### Main Tables
- `profiles` - User profiles and settings
- `content_ideas` - Generated content ideas
- `personas` - Target audience personas
- `teams` - Collaboration teams
- `team_members` - Team membership
- `notifications` - User notifications
- `user_settings` - User preferences

See individual migration files in `supabase/migrations/` for detailed schemas.

---

## 🔐 Security

- **Row Level Security (RLS)**: All tables protected
- **Environment Variables**: Sensitive data never committed
- **Auth Tokens**: Secure JWT-based authentication
- **HTTPS Only**: Enforced in production
- **Input Validation**: Client and server-side validation

---

## 🌐 Deployment

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Deploy to Vercel/Netlify

1. Connect your repository
2. Set environment variables in the platform
3. Deploy!

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 🐛 Known Issues & Roadmap

### Current Issues
- None reported

### Roadmap
- [ ] Mobile app (React Native)
- [ ] Content analytics dashboard
- [ ] AI image generation integration
- [ ] Advanced scheduling (recurring posts)
- [ ] Content templates library

---

## 💬 Support

For questions or issues:
- Open an issue on GitHub
- Contact: brunolbacelar@gmail.com

---

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [Supabase](https://supabase.com/) for backend infrastructure
- [n8n](https://n8n.io/) for workflow automation
- All open-source contributors

---

<div align="center">
Made with ❤️ by Bruno Bacelar
</div>
