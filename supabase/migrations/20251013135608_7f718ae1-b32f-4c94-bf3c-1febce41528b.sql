-- Rename description column to ingredients in product_categories table
ALTER TABLE product_categories 
RENAME COLUMN description TO ingredients;