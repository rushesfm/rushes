import { db, Comment } from 'astro:db';

export default async function() {
  await db.insert(Comment).values([
    { author: "owen", body: "d69a94d1-37b4-46ac-9a04-7806e0e3cd93", title: "Communicating with Horses" },
    { author: "owen", body: "603c6da3-afe5-49d7-8149-defc08d95940", title: "Cossack Riders in Spirit of the Horse Show" },
  ]);

}