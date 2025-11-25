const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Tus datos de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const apiKey = 'AIzaSyBZQnrDOm-40Mk6l9Qt48tObQtjWtM8IdA';

const PORT = process.env.PORT || 3000;

const css = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Roboto+Slab&display=swap');

body { 
  font-family: 'Roboto Slab', serif; 
  margin:0; padding:20px; 
  background:#f5f3ef; color:#3e3a36; 
}

header { text-align:center; margin-bottom:20px; }

h1 { 
  font-family: 'MedievalSharp', cursive; 
  color:#c49a6c; 
  font-size:32px; 
  text-shadow: 2px 2px 4px rgba(0,0,0,0.15);
  margin-bottom: 10px;
}

#grid { 
  display:flex; flex-direction:column; gap:14px; padding-bottom:40px; 
}

.libro { 
  background:#fff8f0; border-radius:8px; padding:12px; 
  display:flex; flex-direction:row; align-items:center; gap:12px; 
  box-sha
