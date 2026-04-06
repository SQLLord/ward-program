// src/components/WardDisclaimer.jsx
import React from 'react';

export default function WardDisclaimer({ wardName, stakeName }) {
    return (
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-slate-700 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500 leading-relaxed">
                This website is not an official{' '}
                <a
                    href="https://www.churchofjesuschrist.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-500 dark:hover:text-slate-400 transition"
                >
                    Church of Jesus Christ of Latter-day Saints
                </a>{' '}
                website. It is an independent tool created to assist the{' '}
                <strong className="text-gray-500 dark:text-slate-400">{wardName}</strong>
                {stakeName && (
                    <>, <strong className="text-gray-500 dark:text-slate-400">{stakeName}</strong></>
                )}{' '}
                with sacrament meeting programs and is not sponsored, endorsed, or
                officially affiliated with the Church.
            </p>
        </div>
    );
}