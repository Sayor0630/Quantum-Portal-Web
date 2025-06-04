import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AdminUser from '../../../models/AdminUser'; // Corrected path
import bcrypt from 'bcrypt';
import connectToDatabase from '../../../lib/dbConnect';
import { NextApiRequest, NextApiResponse } from 'next';

// Define a type for the user object that authorize and jwt callbacks expect
interface IUser extends Object {
    id: string;
    email: string;
    role: string;
    // Add other properties if your user object has them
}

export const authOptions: AuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<IUser | null> {
        if (!credentials?.email || !credentials.password) {
          console.log("Missing credentials");
          return null;
        }

        try {
          await connectToDatabase();
          console.log("Connected to DB for auth");

          const admin = await AdminUser.findOne({ email: credentials.email }).exec();
          if (!admin) {
            console.log("Admin not found:", credentials.email);
            return null;
          }
          console.log("Admin found:", admin.email);

          // Ensure admin.password is a string
          if (typeof admin.password !== 'string') {
            console.error("Password is not a string for admin:", admin.email);
            return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, admin.password);
          if (!isValidPassword) {
            console.log("Invalid password for admin:", admin.email);
            return null;
          }
          console.log("Password valid for admin:", admin.email);

          return { id: admin._id.toString(), email: admin.email, role: admin.role };
        } catch (error) {
          console.error("Error in authorize callback:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // The 'user' object here is the one returned from the authorize callback
      if (user) {
        const typedUser = user as IUser; // Cast user to IUser
        token.id = typedUser.id;
        token.role = typedUser.role;
         // Persist these additional properties in the JWT
      }
      return token;
    },
    async session({ session, token }) {
      // Token contains the data from the jwt callback
      if (session.user) {
        session.user.id = token.id as string; // Add id to session user
        session.user.role = token.role as string; // Add role to session user
      }
      return session;
    }
  },
  pages: {
    signIn: '/admin/login', // A custom login page (optional)
  },
  secret: process.env.NEXTAUTH_SECRET,
  // You might want to add a logger for debugging in development
  // debug: process.env.NODE_ENV === 'development',
};

// The handler needs to be correctly typed for Next.js API routes
export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  // Do whatever you need here, before the request is passed down to NextAuth
  return await NextAuth(req, res, authOptions);
}
