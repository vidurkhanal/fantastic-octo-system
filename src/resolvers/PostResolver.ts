import { Post } from "../entities/Post";
import { MyContext } from "src/types";
import { Resolver, Query, Ctx, Arg, Mutation } from "type-graphql";

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  AllPosts(@Ctx() { em }: MyContext): Promise<Post[]> {
    return em.find(Post, {});
  }

  @Query(() => Post, { nullable: true })
  PostById(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    return em.findOne(Post, { id });
  }

  @Mutation(() => Post)
  async CreatePost(
    @Arg("title") title: string,
    @Ctx() { em }: MyContext
  ): Promise<Post> {
    const post = em.create(Post, { title });
    em.persistAndFlush(post);
    return post;
  }

  @Mutation(() => Post)
  async UpdatePost(
    @Arg("newTitle", { nullable: true }) newTitle: string,
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.findOne(Post, { id });
    if (!post) {
      return null;
    }

    if (typeof newTitle !== "undefined") {
      post.title = newTitle;
    }

    em.persistAndFlush(post);
    return post;
  }

  @Mutation(() => Boolean)
  async DeletePost(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<boolean> {
    try {
      await em.nativeDelete(Post, { id });
      return true;
    } catch (e) {
      return false;
    }
  }
}
