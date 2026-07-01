'use client'

import { useState,useEffect,useCallback } from "react"
import Chat from "./Chat"
import BranchTree  from "./BranchTree"
import * as api from '@/lib/api'

export default function Main() {
    const [sessionId,setSessionId]=useState<string|null>(null)
}

