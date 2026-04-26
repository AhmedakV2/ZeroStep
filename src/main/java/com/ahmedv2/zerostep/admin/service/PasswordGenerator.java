package com.ahmedv2.zerostep.admin.service;

import org.springframework.stereotype.Component;
import java.security.SecureRandom;

@Component
public class PasswordGenerator {

    private static final String UPPERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final String LOWERS = "abcdefghijkmnpqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String SYMBOLS = "@$!%*?&";
    private static final String ALL = UPPERS + LOWERS + DIGITS + SYMBOLS;

    private final SecureRandom random = new SecureRandom();

    public String generate(){
        StringBuilder sb = new StringBuilder(16);
        sb.append(pick(UPPERS));
        sb.append(pick(LOWERS));
        sb.append(pick(DIGITS));
        sb.append(pick(SYMBOLS));
        for(int i = 0; i < 12; i++){
            sb.append(pick(ALL));
        }
        return shuffle(sb.toString());
    }

    private char pick(String source){
        return source.charAt(random.nextInt(source.length()));
    }

    private String shuffle(String input){
        char[] arr = input.toCharArray();
        for(int i = arr.length - 1; i > 0; i--){
            int j = random.nextInt(i+1);
            char tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return new String(arr);
    }

}
