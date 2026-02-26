# 🛡️ Shivam Link Protector

A modern link protection service that hides your original URLs from visitors. When someone visits your protected link, they see the content but cannot see or copy the original URL from the browser address bar.

## ✨ Features

- **🔒 URL Hidden** - Original URL is completely hidden from visitors
- **🛡️ Security Protection** - Prevents right-click, developer tools, and copying
- **⚡ Fast & Modern** - Clean, responsive UI with smooth animations
- **📊 Analytics** - Track clicks and monitor link performance
- **⏰ Expiration** - Set optional expiration times for links
- **🎨 Custom Aliases** - Create memorable custom short links
- **📱 Mobile Friendly** - Works perfectly on all devices

## 🚀 Deploy to Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shivam-link-protector.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your repository
5. Add environment variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `BASE_URL` - Your Vercel app URL (e.g., https://your-app.vercel.app)
6. Click "Deploy"

### Step 3: Set Up MongoDB (Free)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (free tier)
4. Create a database user
5. Whitelist all IPs (0.0.0.0/0) for Vercel
6. Get your connection string and add to Vercel environment variables

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- MongoDB (optional - falls back to in-memory storage)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/shivam-link-protector.git
cd shivam-link-protector

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Start the server
npm start
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/shivam-link-protector
BASE_URL=http://localhost:3000
```

## 📁 Project Structure

```
shivam-link-protector/
├── config/
│   └── database.js       # Database configuration
├── models/
│   └── Url.js            # URL model
├── public/
│   ├── css/
│   │   └── styles.css    # Styles
│   ├── js/
│   │   └── app.js        # Frontend JavaScript
│   └── index.html        # Main HTML
├── routes/
│   ├── proxyRoutes.js    # Proxy routes (URL hiding)
│   ├── redirectRoutes.js # Redirect routes
│   └── urlRoutes.js      # API routes
├── utils/
│   ├── shortCodeGenerator.js
│   └── urlValidator.js
├── .env
├── .gitignore
├── package.json
├── server.js
└── vercel.json           # Vercel configuration
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shorten` | Create a protected link |
| GET | `/api/stats/:code` | Get link analytics |
| GET | `/api/urls` | Get all links (paginated) |
| DELETE | `/api/urls/:id` | Delete a link |
| GET | `/:code` | Redirect to protected content |
| GET | `/proxy/:code` | Serve content with hidden URL |

### Create Protected Link

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/secret-page"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "shortCode": "abc123",
    "shortUrl": "http://localhost:3000/abc123",
    "originalUrl": "https://example.com/secret-page"
  }
}
```

## 🔒 Security Features

When visitors access a protected link:

1. **URL Hidden** - The browser address bar shows the short URL, not the original
2. **Right-click Disabled** - Context menu is blocked
3. **DevTools Blocked** - F12, Ctrl+Shift+I, etc. are blocked
4. **Copy Blocked** - Ctrl+C, Ctrl+U are blocked
5. **Text Selection Disabled** - Cannot select and copy text
6. **Drag Disabled** - Cannot drag elements

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 👤 Author

**Shivam**

---

Made with ❤️ by Shivam
