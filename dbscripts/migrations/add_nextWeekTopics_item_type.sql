-- Migration: Add 'nextWeekTopics' to meeting_items item_type constraint
-- Run once against ward_programs database

USE [ward_programs]
GO

ALTER TABLE [dbo].[meeting_items] DROP CONSTRAINT [chk_meeting_item_type];
GO

ALTER TABLE [dbo].[meeting_items] WITH CHECK ADD CONSTRAINT [chk_meeting_item_type] CHECK (
    [item_type] = 'customText'
    OR [item_type] = 'nextWeekTopics'
    OR [item_type] = 'confirmation'
    OR [item_type] = 'baptism'
    OR [item_type] = 'testimony'
    OR [item_type] = 'announce'
    OR [item_type] = 'musical'
    OR [item_type] = 'speaker'
    OR [item_type] = 'sacramentAdmin'
    OR [item_type] = 'closingPrayer'
    OR [item_type] = 'openingPrayer'
    OR [item_type] = 'hymn'
    OR [item_type] = 'closingHymn'
    OR [item_type] = 'sacramentHymn'
    OR [item_type] = 'childrensHymn'
    OR [item_type] = 'openingHymn'
);
GO

ALTER TABLE [dbo].[meeting_items] CHECK CONSTRAINT [chk_meeting_item_type];
GO
