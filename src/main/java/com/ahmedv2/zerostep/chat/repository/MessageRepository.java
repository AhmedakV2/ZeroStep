package com.ahmedv2.zerostep.chat.repository;

import com.ahmedv2.zerostep.chat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // Konuşmanın mesajları; eskiden yeniye (user görünümü, admin görmez silinenleri)
    @Query("""
        SELECT m FROM Message m JOIN FETCH m.sender
        WHERE m.conversation.id = :convId AND m.deleted = false
        ORDER BY m.sentAt ASC
        """)
    Page<Message> findByConversation(@Param("convId") Long convId, Pageable pageable);

    // Admin için; silinen mesajlar dahil
    @Query("""
        SELECT m FROM Message m JOIN FETCH m.sender
        WHERE m.conversation.id = :convId
        ORDER BY m.sentAt ASC
        """)
    Page<Message> findByConversationAdmin(@Param("convId") Long convId, Pageable pageable);

    Optional<Message> findByPublicId(UUID publicId);

    // Karşı tarafın okunmamış mesajlarını okundu olarak işaretle
    @Modifying
    @Query("""
        UPDATE Message m SET m.readAt = :now
        WHERE m.conversation.id = :convId
          AND m.sender.id <> :readerId
          AND m.readAt IS NULL
          AND m.deleted = false
        """)
    int markConversationRead(@Param("convId") Long convId,
                             @Param("readerId") Long readerId,
                             @Param("now") Instant now);

    // Okunmamış mesaj sayısı (kullanıcının dahil olduğu tüm konuşmalarda)
    @Query("""
        SELECT COUNT(m) FROM Message m
        WHERE (m.conversation.userOne.id = :userId OR m.conversation.userTwo.id = :userId)
          AND m.sender.id <> :userId
          AND m.readAt IS NULL
          AND m.deleted = false
        """)
    long countUnreadByUser(@Param("userId") Long userId);
}