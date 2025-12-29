# ---- Base OS ----
FROM node:20-bullseye

# ---- Install Verilog tools ----
RUN apt-get update && \
    apt-get install -y iverilog && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ---- App directory ----
WORKDIR /app

# ---- Install node dependencies ----
COPY package*.json ./
RUN npm install

# ---- Copy source code ----
COPY . .

# ---- Expose port (Render uses env PORT) ----
EXPOSE 3000

# ---- Start server ----
CMD ["npm", "start"]
