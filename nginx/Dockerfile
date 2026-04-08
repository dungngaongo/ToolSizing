FROM nginx:1.25-alpine

# copy config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# copy frontend
COPY frontend /usr/share/nginx/html/frontend
COPY dashboard /usr/share/nginx/html/dashboard

# fix permission (chỉ cần read)
RUN chmod -R 755 /usr/share/nginx/html