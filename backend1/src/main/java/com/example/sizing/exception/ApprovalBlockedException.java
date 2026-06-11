package com.example.sizing.exception;

import com.example.sizing.dto.ApprovalIssue;

import java.util.List;

public class ApprovalBlockedException extends RuntimeException {
    private final List<ApprovalIssue> approvalIssues;

    public ApprovalBlockedException(String message, List<ApprovalIssue> approvalIssues) {
        super(message);
        this.approvalIssues = approvalIssues;
    }

    public List<ApprovalIssue> getApprovalIssues() {
        return approvalIssues;
    }
}
