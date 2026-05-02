package com.ahmedv2.zerostep.chat.repository;

import com.ahmedv2.zerostep.chat.entity.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    // Kullanıcının dahil olduğu konuşmalar; son mesaja göre sıralı
    @Query("""
        SELECT c FROM Conversation c
        JOIN FETCH c.userOne JOIN FETCH c.userTwo
        WHERE c.userOne.id = :userId OR c.userTwo.id = :userId
        ORDER BY c.lastMessageAt DESC NULLS LAST
        """)
    Page<Conversation> findByParticipant(@Param("userId") Long userId, Pageable pageable);

    // İki kullanıcı arasında mevcut konuşma var mı? (normalize edilmiş sırada arar)
    @Query("""
        SELECT c FROM Conversation c
        WHERE c.userOne.id = :oneId AND c.userTwo.id = :twoId
        """)
    Optional<Conversation> findByUserPair(@Param("oneId") Long oneId,
                                          @Param("twoId") Long twoId);

    @Query("SELECT c FROM Conversation c JOIN FETCH c.userOne JOIN FETCH c.userTwo " +
            "WHERE c.publicId = :publicId")
    Optional<Conversation> findByPublicId(@Param("publicId") UUID publicId);

    // Admin: tüm konuşmalar + opsiyonel username filtresi
    @Query("""
        SELECT c FROM Conversation c
        JOIN FETCH c.userOne u1 JOIN FETCH c.userTwo u2
        WHERE (:search = ''
               OR LOWER(u1.username) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(u2.username) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY c.lastMessageAt DESC NULLS LAST
        """)
    Page<Conversation> findAllForAdmin(@Param("search") String search, Pageable pageable);
}