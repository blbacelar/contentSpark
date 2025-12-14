# Supabase Schema Issue: Personas

You are encountering the error: `duplicate key value violates unique constraint "personas_user_id_key"`

## The Problem
This error occurs because your `personas` table in Supabase has a **Unique Constraint** on the `user_id` column. This configuration restricts each user to having **only one persona**.

However, your application limits (Free vs Pro) and UI are designed to support **multiple personas** per user.

## The Solution
To fix this, you need to remove the unique constraint on `user_id` in your Supabase database.

### Option 1: Using SQL Editor (Recommended)
Run the following SQL query in your Supabase SQL Editor:

```sql
ALTER TABLE personas DROP CONSTRAINT personas_user_id_key;
```

### Option 2: Using Table Editor
1. Go to the **Table Editor** in Supabase.
2. Select the `personas` table.
3. Click on the arrow next to the `user_id` column name to edit it.
4. **Uncheck** the "Is Unique" property (if accessible directly) or go to the "Constraints" / "Indexes" section of the table settings and delete the unique index for `user_id`.

## About n8n Usage
Currently, the application tries to:
1. **Insert directly into Supabase** (This is where it fails).
2. **Then call the n8n webhook** (`save-persona`) with the new data.

Because the Supabase insert fails due to the constraint, the n8n webhook is never triggered.
