import { Post } from "../entities/Post";
import {
  Resolver,
  Query,
  Arg,
  Mutation,
  InputType,
  Field,
  Ctx,
  UseMiddleware,
  Int,
  FieldResolver,
  Root,
} from "type-graphql";
import { getConnection } from "typeorm";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  content: string;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.content.slice(0, 50) + "...";
  }

  @Query(() => [Post])
  AllPosts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<Post[]> {
    const realLimit = Math.min(50, limit);
    let qb = getConnection()
      .getRepository(Post)
      .createQueryBuilder("p")
      .orderBy('"createdAt"', "DESC")
      .take(realLimit);

    if (cursor) {
      qb = qb.where('"createdAt"<:cursor', {
        cursor: new Date(parseInt(cursor)),
      });
    }

    return qb.getMany();
  }

  @Query(() => Post, { nullable: true })
  PostById(@Arg("id") id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async CreatePost(
    @Arg("options") options: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    const result = await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Post)
      .values({
        title: options.title,
        content: options.content,
        creatorID: req.session.userId,
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
