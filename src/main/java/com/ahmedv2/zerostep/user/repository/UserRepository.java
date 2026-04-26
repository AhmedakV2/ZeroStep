package com.ahmedv2.zerostep.user.repository;

import com.ahmedv2.zerostep.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.roles WHERE u.username = :username AND u.deletedAt IS NULL")
    Optional<User> findByUsernameWithRoles(@Param("username") String username);

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.roles WHERE u.publicId = :publicId AND u.deletedAt IS NULL")
    Optional<User> findByPublicIdWithRoles(@Param("publicId") UUID publicId);

    Optional<User> findByPublicId(UUID publicId);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    // search bos string ise tum aktif kullanicilar dondurulur; null check yerine string karsilastirmasi
    // COALESCE ile bytea cast sorunu bypass edilir
    @Query(value = "SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.roles WHERE u.deletedAt IS NULL " +
            "AND (:search = '' " +
            "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))",
            countQuery = "SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL " +
                    "AND (:search = '' " +
                    "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
                    "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<User> searchActive(@Param("search") String search, Pageable pageable);

    @Query("SELECT COUNT(DISTINCT u) FROM User u JOIN u.roles r " +
            "WHERE r.name = 'ADMIN' AND u.enabled = TRUE AND u.deletedAt IS NULL")
    long countActiveAdmins();
}