const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateUser } = require("./userCheck");
const { deleteImageFromS3 } = require("./review");
const router = express.Router();

module.exports = (db) => {
  function adminCheck(user) {
    if (user.role !== "ADMIN") return res.status(202).send("no admin");
  }
  router.get(`/check`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    return res.status(200).send("OK");
  });

  router.get(`/user/list`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    db.query(`SELECT * FROM users`, (error, results) => {
      if (error) return res.status(400).send(error);
      res.json(results);
    });
  });

  router.delete(`/user/delete/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const deleteId = req.params.id;
    adminCheck(user);
    db.query(`DELETE FROM users WHERE id = ?`, [deleteId], (error, results) => {
      if (error) return res.status(400).send(error);
      res.send("delete complete");
    });
  });

  router.get(`/room/list`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    db.query(`SELECT * FROM room`, (error, results) => {
      if (error) return res.status(400).send(error);
      res.json(results);
    });
  });

  router.delete(`/room/delete/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const deleteId = req.params.id;
    adminCheck(user);
    db.query(`DELETE FROM room WHERE id = ?`, [deleteId], (error, results) => {
      if (error) return res.status(400).send(error);
      res.send("delete complete");
    });
  });

  router.get(`/review/list`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    db.query(
      `SELECT
    review.id,
    JSON_OBJECT(
      'id', room.id,
      'building', room.building,
      'newAddress', room.newAddress,
      'oldAddress', room.oldAddress,
      'latitude', room.latitude,
      'longitude', room.longitude,
      'sido', room.sido,
      'sigungu', room.sigungu,
      'dong', room.dong
    ) AS room,
    review.userId,
    review.nickname,
    review.pros,
    review.cons,
    review.score
  FROM
    review
  INNER JOIN
    room ON review.roomId = room.id 
  ORDER BY
    review.id DESC`,
      (error, results) => {
        if (error) return res.status(400).send(error);
        //룸 객체 변환
        results.forEach((result) => {
          result.room = JSON.parse(result.room);
        });
        return res.status(200).send(results);
      }
    );
  });

  router.delete(`/review/delete/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    const reviewId = req.params.id;
    let roomId;
    db.query(
      `SELECT * FROM review WHERE id = ?`,
      [reviewId],
      async (error, results) => {
        if (error) return res.status(400).send(error);
        roomId = results[0].roomId;
        if (imageUrl !== "")
          //리뷰에 사진이 있을 경우 aws 사진 삭제
          await deleteImageFromS3(
            "homereview1",
            results[0].imageUrl.split(".com/")[1]
          );
        db.query(
          `SELECT COUNT(*) AS count FROM review WHERE roomId = ?`,
          [roomId],
          (error, results) => {
            if (error) return res.status(400).send(error);

            if (results[0].count === 1)
              db.query(
                `DELETE FROM room WHERE id = ?`,
                [roomId],
                (error, results) => {
                  if (error) return res.status(400).send(error);
                }
              );

            db.query(
              `DELETE FROM review WHERE id = ?`,
              [reviewId],
              (error, results) => {
                if (error) return res.status(400).send(error);
                return res.status(200).send("OK");
              }
            );
          }
        );
      }
    );
  });

  router.get(`/comment/list`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    db.query(`SELECT * FROM comments`, (error, results) => {
      if (error) return res.status(400).send(error);
      res.json(results);
    });
  });

  router.delete(`/comment/delete/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const deleteId = req.params.id;
    adminCheck(user);
    db.query(
      `DELETE FROM comments WHERE id = ?`,
      [deleteId],
      (error, results) => {
        if (error) return res.status(400).send(error);
        res.send("delete complete");
      }
    );
  });

  router.get(`/posting/list`, authenticateUser(db), (req, res) => {
    const user = req.user;
    adminCheck(user);
    db.query(`SELECT * FROM posting`, (error, results) => {
      if (error) return res.status(400).send(error);
      res.json(results);
    });
  });

  router.delete(`/posting/delete/:id`, authenticateUser(db), (req, res) => {
    const user = req.user;
    const deleteId = req.params.id;
    adminCheck(user);
    db.query(
      `DELETE FROM posting WHERE id = ?`,
      [deleteId],
      (error, results) => {
        if (error) return res.status(400).send(error);
        res.send("delete complete");
      }
    );
  });

  return router;
};
