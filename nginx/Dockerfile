# FROM registry-lab.kcntt.net/library/nginx:alpine

# # copy config
# COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# # copy frontend
# COPY frontend /usr/share/nginx/html/frontend
# COPY dashboard /usr/share/nginx/html/dashboard

# # phân quyền user non-root
# RUN chmod -R 755 /usr/share/nginx/html \
#     && chown -R nginx:nginx /usr/share/nginx/html \
#     && chown nginx:nginx /etc/nginx/conf.d/default.conf \
#     && chown -R nginx:nginx /var/cache/nginx \
#     && chown -R nginx:nginx /var/log/nginx \
#     && chown -R nginx:nginx /etc/nginx/conf.d \
#     && touch /var/run/nginx.pid \
#     && chown nginx:nginx /var/run/nginx.pid
# EXPOSE 80
# USER nginx



FROM registry-lab.kcntt.net/library/nginx:alpine

# Bước 1: Chuẩn bị trước các thư mục hệ thống của Nginx dưới quyền root
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Bước 2: Sắp xếp các file ít thay đổi lên trước để tận dụng Cache
COPY --chown=nginx:nginx nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Bước 3: Đưa các thư mục code thay đổi liên tục xuống cuối cùng
COPY --chown=nginx:nginx frontend /usr/share/nginx/html/frontend
COPY --chown=nginx:nginx dashboard /usr/share/nginx/html/dashboard

# Bước 4: Chuyển sang port cho user non-root
EXPOSE 8080

USER nginx