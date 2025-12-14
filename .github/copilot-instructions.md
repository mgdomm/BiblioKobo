# GitHub Copilot Instructions for BiblioKobo

## Project Overview

**BiblioKobo** (Azkaban Reads) is a personal library management web application with a dark Harry Potter-inspired theme. It allows users to search, sort, and download EPUB books with Google Drive and Google Books API integration.

### Tech Stack
- **Backend**: Node.js + Express.js
- **Architecture**: Monolithic server (server.js ~3200+ lines)
- **Storage**: JSON-based database (books.json)
- **APIs**: Google Drive API, Google Books API, Open Library API
- **Frontend**: Server-rendered HTML with embedded CSS/JavaScript
- **Dependencies**: archiver, axios, compression, express, googleapis, multer, sharp

## Language & Style

### Primary Language
- **Spanish**: All code comments, variable names (where contextual), error messages, and UI text should be in Spanish
- Exception: Standard JavaScript/Node.js conventions (e.g., `req`, `res`, `next`, `app`)

### Code Style
- Use `const` for constants, avoid `var`
- Use template literals for string interpolation
- Follow existing indentation (2 spaces)
- Keep function names descriptive in Spanish when contextual (e.g., `obtenerPortada`, `sincronizarGoogleBooks`)

## Architecture Conventions

### Monolithic Structure
- **Primary file**: `server.js` contains all routes, middleware, CSS, and HTML templates
- **Inline HTML**: Routes return HTML strings directly using template literals
- **Embedded CSS**: CSS is defined as a string constant (`css`) in server.js
- **No separate view files**: All UI is generated in route handlers

### Route Organization (in server.js)
1. Test routes (`/test-buttons`)
2. Public routes (`/`, `/libros`, `/autores`, `/sagas`, `/libro`, `/download`)
3. Protected routes with `checkAuth` middleware (`/stats`, `/upload`, `/dashboard`)
4. API routes (`/api/*`)

### Authentication
- Simple password-based auth via `checkAuth` middleware
- Password from env: `process.env.ADMIN_PASS` or default `252914`
- Access denied messages use random Harry Potter-themed Spanish messages

## Design System

### Color Palette
```css
Primary:    #19E6D6  /* Cyan - buttons, links, accents */
Background: #000     /* Black */
Text:       #fff     /* White */
Card BG:    rgba(18,18,18,0.92) to rgba(12,12,12,0.9) /* Dark gradient */
Borders:    rgba(255,255,255,0.04) /* Subtle white */
```

### Typography
- **Headers**: 'MedievalSharp' (Google Font) - Harry Potter theme
- **Body**: Garamond, serif
- **Title sizes**: h1 56px (desktop), 48px (tablet), 38px (mobile)

### Layout
- **Grid**: `repeat(auto-fit, minmax(130px, 130px))`
- **Book cards**: 130px wide, responsive gap of 30px
- **Banner heights**: 290px (desktop), 230px (tablet), 220px (mobile)

### Responsive Breakpoints
```css
Desktop:  >= 1024px
Tablet:   768px - 1023px
Mobile:   < 768px
```

## Key Features & Implementation Patterns

### 1. Book Cover Handling
- **Priority**: Google Books API > local cover folder > placeholder
- **Folder structure**: 
  - `cover/portada/portada1.jpg` (main cover)
  - `cover/secuendarias/portada11.jpg` (secondary covers)
- **Caching**: 7-day cache for static covers
- **API endpoint**: `/api/book-cover?id=...&title=...&author=...`

### 2. Google Books Integration
- **Rate limiting**: 800ms between requests
- **Auto-fetch**: Triggered on book metadata updates
- **Endpoint**: `/api/sync-google-books`
- **Data fetched**: Covers, descriptions, ratings

### 3. Google Drive Integration
- **Auth options**: 
  1. Service Account (read-only, recommended)
  2. OAuth2 (read/write)
- **Credentials**: `service-account.json` or `oauth-credentials.json`
- **Upload endpoint**: `POST /api/upload-to-drive`

### 4. Download Features
- **Single**: `GET /download?id=...`
- **Multiple**: `POST /download-zip` (creates ZIP archive)
- **Format**: EPUB only

### 5. Fade Effect
- Progressive opacity on book cards as they scroll under banner
- Configuration in JavaScript:
  ```javascript
  const offset = 100;        // px offset from banner bottom
  const fadeLength = 150;    // Transition smoothness
  const minOpacity = 0.15;   // Minimum opacity when hidden
  ```

## Common Patterns

### Route Handler Pattern
```javascript
app.get('/route', async (req, res) => {
  // 1. Extract query params
  const { param } = req.query;
  
  // 2. Load data
  const data = await loadData();
  
  // 3. Process
  const processed = processData(data);
  
  // 4. Return inline HTML with embedded styles
  res.send(`<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Título</title>
      <style>${css}</style>
    </head>
    <body>
      <!-- Header banner -->
      <div class="header-banner top" style="background-image:url('/cover/portada/portada1.jpg');"></div>
      <!-- Content -->
    </body>
    </html>`);
});
```

### Protected Route Pattern
```javascript
app.get('/protected', checkAuth, async (req, res) => {
  // Route logic
});
```

### API Response Pattern
```javascript
app.get('/api/endpoint', async (req, res) => {
  try {
    // Logic
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

## Data Management

### books.json Structure
```json
{
  "id": "unique-id",
  "titulo": "Book Title",
  "autor": "Author Name",
  "saga": "Series Name",
  "numero": 1,
  "sinopsis": "Description...",
  "portada": "URL or path",
  "driveId": "Google Drive file ID",
  "googleBooksId": "Google Books ID",
  "rating": 4.5
}
```

### Data Loading Pattern
```javascript
function loadBooks() {
  if (!fs.existsSync(BOOKS_JSON)) {
    fs.writeFileSync(BOOKS_JSON, JSON.stringify([]), 'utf8');
  }
  const data = fs.readFileSync(BOOKS_JSON, 'utf8');
  return JSON.parse(data);
}
```

## Error Handling

### User-Facing Errors
- Use Harry Potter-themed Spanish messages
- Return proper HTTP status codes
- Include navigation back to home

### API Errors
```javascript
try {
  // API logic
} catch (err) {
  console.error('Descripción del error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Mensaje descriptivo en español' 
  });
}
```

## Best Practices

### When Adding Features
1. **Maintain monolithic structure**: Add to server.js unless absolutely necessary
2. **Follow existing patterns**: Match the inline HTML/CSS approach
3. **Preserve theme**: Use MedievalSharp font and cyan (#19E6D6) color
4. **Respect Spanish language**: All user-facing text in Spanish
5. **Consider Kobo devices**: Maintain lightweight alternatives

### When Modifying CSS
- Edit the `css` constant in server.js (around line 334)
- Maintain responsive breakpoints
- Preserve dark theme and Harry Potter aesthetic
- Test fade effect if modifying book cards or banner

### When Adding Routes
- Follow route organization order in server.js
- Use `checkAuth` for admin-only routes
- Include proper error handling
- Return inline HTML matching existing structure

### When Working with External APIs
- Implement rate limiting (especially Google Books: 800ms)
- Cache responses when possible
- Provide fallback mechanisms
- Log errors descriptively

## Common Tasks

### Add a New Route
```javascript
app.get('/nueva-ruta', async (req, res) => {
  const books = loadBooks();
  res.send(`<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Nueva Página - Azkaban Reads</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="header-banner top" style="background-image:url('/cover/portada/portada1.jpg');"></div>
      <div class="overlay top">
        <div class="top-buttons secondary"><a href="/">Inicio</a></div>
        <h1>Azkaban</h1>
        <div class="top-buttons">
          <a href="/libros">Libros</a>
          <a href="/autores">Autores</a>
          <a href="/sagas">Sagas</a>
        </div>
      </div>
      <div style="margin-top:250px; padding:40px 20px;">
        <!-- Contenido aquí -->
      </div>
    </body>
    </html>`);
});
```

### Add CSS Styles
Locate the `css` constant (line ~334) and add styles maintaining the pattern:
```javascript
const css = `
  /* Existing styles... */
  
  .new-class { 
    background: #000;
    color: #19E6D6;
    font-family: 'MedievalSharp', cursive;
  }
`;
```

### Add API Endpoint
```javascript
app.get('/api/nuevo-endpoint', async (req, res) => {
  try {
    const books = loadBooks();
    // Lógica aquí
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en nuevo-endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: 'No se pudo completar la operación' 
    });
  }
});
```

## Testing

- **Current state**: No automated tests
- **Manual testing**: Use browser refresh and test endpoints
- **Test pages**: `/test-buttons` available for UI testing
- **Kobo testing**: Test lightweight version without images

## Environment Variables

```bash
PORT=3000                      # Server port (default: 3000)
ADMIN_PASS=252914              # Admin password (default: 252914)
GOOGLE_BOOKS_API_KEY=...       # Google Books API key (optional)
```

## File Structure Guidelines

### Main Files
- `server.js` - Primary application file (DO modify)
- `books.json` - Book database (auto-generated/modified by app)
- `package.json` - Dependencies (modify when adding packages)

### Support Files
- `service-account.json` - Google credentials (gitignored)
- `oauth-credentials.json` - OAuth credentials (gitignored)
- `oauth-token.json` - OAuth token cache (gitignored)

### Utility Scripts (Helper Scripts)
- `clean-drive.js`, `compress-image.js`, `sync-json-drive.js`, etc.
- These are standalone utilities, rarely modified

### Static Assets
- `cover/portada/` - Main covers
- `cover/secuendarias/` - Secondary covers

## Deployment Notes

- Run with: `npm start` or `node server.js`
- Port defaults to 3000
- Ensure Google credentials are in place before first run
- Share Google Drive folder with service account email

## Debugging Tips

1. **Server won't start**: Check `node -c server.js` for syntax errors
2. **Covers not loading**: Verify Google credentials and rate limits
3. **Changes not visible**: Hard refresh browser (Ctrl+Shift+R)
4. **Auth issues**: Verify ADMIN_PASS environment variable

## Priority Guidelines

When making suggestions:
1. **Preserve existing structure**: Don't suggest breaking up server.js unless critical
2. **Maintain aesthetic**: Keep dark Harry Potter theme
3. **Spanish first**: All UI text in Spanish
4. **Mobile friendly**: Ensure responsive design
5. **Kobo compatible**: Consider low-resource device support

---

**Last Updated**: December 2024
**Version**: 2.0 (fade effect, full responsive, improved sort button)
