FROM node:22-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
WORKDIR /app
COPY --chown=node:node package.json package-lock.json LICENSE THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "server/index.js"]
