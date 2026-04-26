package com.ahmedv2.zerostep.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Short id;

    @Column(nullable = false,unique = true,length = 32)
    private String name;

    @Column(length = 255)
    private String description;

    @Column(name = "created_at",nullable = false,updatable = false)
    private Instant createdAt;


}
