FROM nginx:alpine
WORKDIR /usr/share/nginx/html/
COPY . .
RUN rm -f Dockerfile nginx.conf.dockerignore
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
