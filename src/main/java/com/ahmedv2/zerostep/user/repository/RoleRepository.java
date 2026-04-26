package com.ahmedv2.zerostep.user.repository;

import com.ahmedv2.zerostep.user.entity.Role;
import com.ahmedv2.zerostep.user.entity.RoleName;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Short> {
    Optional<Role> findByName(String name);

    default  Optional<Role> findByName(RoleName name){
        return findByName(name.name());
    }
}
