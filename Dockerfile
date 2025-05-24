# Temel Node imajı
FROM node:18

# Uygulama dizinini oluştur
WORKDIR /usr/src/app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Tüm kaynak dosyaları kopyala
COPY . .

# Uygulama 3000 portunda çalışıyorsa expose et
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"]
