package com.example.sizing.repository;

import com.example.sizing.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, String> {
    @Query("SELECT p FROM Project p WHERE p.owner.id = :userId")
    List<Project> findByUserId(@Param("userId") String userId);

    List<Project> findByStatus(String status);

    @Query("SELECT p FROM Project p WHERE p.owner.id = :userId AND p.status = :status")
    List<Project> findByUserIdAndStatus(@Param("userId") String userId, @Param("status") String status);

    @Query("SELECT p FROM Project p WHERE p.assignedAdmin1.id = :assignedAdmin1Id")
    List<Project> findByAssignedAdmin1Id(@Param("assignedAdmin1Id") String assignedAdmin1Id);

    @Query("SELECT p FROM Project p WHERE p.owner.id = :userId OR p.assignedAdmin1.id = :assignedAdmin1Id")
    List<Project> findByUserIdOrAssignedAdmin1Id(@Param("userId") String userId,
                                                 @Param("assignedAdmin1Id") String assignedAdmin1Id);
}

