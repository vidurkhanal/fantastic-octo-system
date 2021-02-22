import { Post } from "../entities/Post";
import { Resolver, Query, Arg, Mutation } from "type-graphql";
import { getConnection } from "typeorm";

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  AllPosts(): Promise<Post[]> {
    return Post.find();
  }

  @Query(() => Post, { nullable: true })
  PostById(@Arg("id") id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  async CreatePost(@Arg("title") title: string): Promise<Post> {
    const result = await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Post)
      .values({
        title,
      })
      .returning("*")
      .execute();
    return result.raw[0];
  }

  @Mutation(() => Post)
  async UpdatePost(
    @Arg("newTitle", { nullable: true }) newTitle: string,
    @Arg("id") id: number
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }

    if (typeof newTitle !== "undefined") {
      Post.update({ id }, { title: newTitle });
    }

    return post;
  }

  @Mutation(() => Boolean)
  async DeletePost(@Arg("id") id: number): Promise<boolean> {
    try {
      await Post.delete(id);
      return true;
    } catch (e) {
      return false;
    }
  }
}
