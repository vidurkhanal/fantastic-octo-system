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
