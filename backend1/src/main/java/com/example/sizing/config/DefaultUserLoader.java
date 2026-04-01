package com.example.sizing.config;

import com.example.sizing.dto.CreateUserRequest;
import com.example.sizing.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Component
public class DefaultUserLoader implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DefaultUserLoader.class);

    private final UserService userService;

    public DefaultUserLoader(UserService userService) {
        this.userService = userService;
    }

    @Override
    public void run(String... args) throws Exception {
        List<CreateUserRequest> defaultUsers = loadFromEnv();

        // Set system authentication so UserService allows creating admin roles during bootstrap
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(
                "system", null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN2"))
        ));
        SecurityContextHolder.setContext(ctx);

        try {
            for (CreateUserRequest req : defaultUsers) {
                try {
                    userService.create(req);
                    log.info("Default user created: {}", req.getUsername());
                } catch (RuntimeException e) {
                    // Already exists or other validation error, skip
                    log.info("Skipping creating default user {}: {}", req.getUsername(), e.getMessage());
                }
            }
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // Tries to read a .env entry DEFAULT_USERS in format: username:password,username2:password2
    private List<CreateUserRequest> loadFromEnv() {
        String line = null;

        // Try classpath resource first
        try (InputStream is = DefaultUserLoader.class.getResourceAsStream("/.env")) {
            if (is != null) {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(is))) {
                    String l;
                    while ((l = r.readLine()) != null) {
                        if (l.trim().startsWith("DEFAULT_USERS=")) {
                            line = l.trim().substring("DEFAULT_USERS=".length());
                            break;
                        }
                    }
                }
            }
        } catch (IOException e) {
            log.debug("No classpath .env found: {}", e.getMessage());
        }

        // If not found in classpath, try working directory .env
        if (line == null) {
            Path envPath = Paths.get(".env");
            if (!Files.exists(envPath)) {
                // try backend1/.env (when running from workspace root)
                envPath = Paths.get("backend1", ".env");
            }
            if (Files.exists(envPath)) {
                try (BufferedReader r = Files.newBufferedReader(envPath)) {
                    String l;
                    while ((l = r.readLine()) != null) {
                        if (l.trim().startsWith("DEFAULT_USERS=")) {
                            line = l.trim().substring("DEFAULT_USERS=".length());
                            break;
                        }
                    }
                } catch (IOException e) {
                    log.warn("Failed to read .env file: {}", e.getMessage());
                }
            }
        }

        List<CreateUserRequest> list = new ArrayList<>();

        if (line == null || line.isEmpty()) {
            // fallback: nothing to load
            log.info("No DEFAULT_USERS entry found in .env; skipping default user creation");
            return list;
        }

        // parse format username:password:role,username2:password2:role2
        String[] entries = line.split(",");
        for (String entry : entries) {
            String e = entry.trim();
            if (e.isEmpty()) continue;
            String[] parts = e.split(":" , 3);
            if (parts.length < 2) continue;
            String username = parts[0].trim();
            String password = parts[1].trim();
            String role = parts.length >=3 ? parts[2].trim() : "user";

            CreateUserRequest req = new CreateUserRequest();
            req.setUsername(username);
            req.setEmail(username + "@example.com");
            req.setPassword(password);
            req.setRole(role);
            list.add(req);
        }

        return list;
    }
}
