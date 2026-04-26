package com.ahmedv2.zerostep.user.entity;

public enum RoleName {

    ADMIN,
    TESTER,
    VIEWER;


    public String asAuthority(){
        return "ROLE_"+ name();
    }
}
