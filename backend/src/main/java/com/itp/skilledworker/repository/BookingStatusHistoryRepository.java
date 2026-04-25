package com.itp.skilledworker.repository;

import com.itp.skilledworker.entity.BookingStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BookingStatusHistoryRepository extends JpaRepository<BookingStatusHistory, Integer> {
    List<BookingStatusHistory> findByBooking_BookingIdOrderByChangedAtAsc(Integer bookingId);

    void deleteByBooking_BookingId(Integer bookingId);
}
