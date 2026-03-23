package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String userId;
    private String username;
    private String displayName;
    private String role;
    private String token;
}
