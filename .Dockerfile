# Node file

FROM node:12.18.4

WORKDIR /home/magoware-backoffice

RUN npm install apidoc pm2 sequelize-cli -g
COPY package.json package-lock.json ./
# RUN npm cache clean --force
RUN npm install

COPY . .

RUN sequelize db:migrate

EXPOSE 80

CMD ["pm2-runtime", "server.js" ]