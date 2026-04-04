# LDS Sacrament Meeting Program - V3.0 COMPLETE

## ✨ What's New in V3.0

### 🎯 Drag-and-Drop Reordering
- Drag speakers to reorder them
- Drag intermediate hymns to reorder
- Drag special musical numbers to reorder
- Look for the ☰ handle - click and drag to reorder!

### 🖨️ Proper Bifold Print Layout
- **Page 1 (Front):** Cover with image, date, quote
- **Page 2 (Inside Spread):** Meeting Order (LEFT) + Announcements (RIGHT) side-by-side
- **Page 3 (Back):** Ward Leadership + Meeting Schedules
- Print ready for folding in half (8.5x11 bifold)

### 👥 Leadership & Schedules Management
- **Step 4:** Edit Ward Leadership (roles, names, phones, emails)
- **Step 4:** Edit Meeting Schedules (organization, day, time, location)
- Shows on back page of printed program

### 🚀 Easy Add Buttons
- All add buttons grouped together in Step 2
- "+ Speaker", "+ Hymn", "+ Musical #" all in one place
- Makes it faster to build programs

## Installation

```bash
npm install
npm run dev
```

Open http://localhost:3000

## How to Use

### Create a Program

1. Go to `/admin`
2. Click "Create New Program"
3. **Step 1 - Cover:** Add date, image URL, quote
4. **Step 2 - Meeting Order:**
   - Fill in conducting, presiding, chorister, accompanist
   - Use grouped buttons: "+ Speaker", "+ Hymn", "+ Musical #"
   - **DRAG TO REORDER:** Click the ☰ handle and drag items up/down
5. **Step 3 - Announcements:** Add announcements, pin important ones
6. **Step 4 - Leadership & Schedules:** 
   - Add ward leadership with contact info
   - Add meeting schedules
7. **Step 5 - Preview:** Review and publish

### Print the Program

1. View any published program
2. Click "🖨️ Print Program"
3. Your browser print dialog opens
4. The program formats as a bifold:
   - **Front:** Cover page
   - **Inside:** Meeting order (left) + Announcements (right)
   - **Back:** Leadership directory + Meeting schedules
5. Print and fold in half!

## Drag-and-Drop Tips

- Look for the **☰** (hamburger icon) on the left of each item
- Click and hold the ☰ icon
- Drag up or down to reorder
- Works for:
  - Speakers
  - Intermediate hymns
  - Special musical numbers

## Print Tips

- Use landscape orientation for best results
- Set margins to 0.5 inches
- Make sure "Print backgrounds" is enabled
- Print double-sided if your printer supports it
- Fold in half to create a booklet

## Features

✅ Drag-and-drop reordering
✅ Proper bifold print layout
✅ Leadership directory editor
✅ Meeting schedules editor  
✅ Live preview panel
✅ Save drafts
✅ Publish programs
✅ Mobile responsive (screen view)
✅ Zero npm warnings
✅ Fast Vite build

## Technology

- React 18.3.1
- Vite 5.4.11
- React Router 6.28
- Tailwind CSS 3.4.15
- HTML5 Drag and Drop API (no external libraries!)

## Next Steps

- Add image upload (currently uses URLs)
- Add user authentication
- Add backend API for persistence
- Export to PDF directly
- Multi-ward support

Perfect for your congregation!
