FROM registry-lab.kcntt.net/library/nginx:alpine

# copy config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# copy frontend
COPY frontend /usr/share/nginx/html/frontend
COPY dashboard /usr/share/nginx/html/dashboard

# phân quyền user non-root
RUN chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chown nginx:nginx /etc/nginx/conf.d/default.conf \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
EXPOSE 80
USER nginx