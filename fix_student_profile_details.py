import re

with open("src/pages/dashboard/admin/StudentProfileView.tsx", "r") as f:
    content = f.read()

# I noticed the previous regex replacement failed silently because the text didn't match perfectly.
# Let's replace the whole identity card content.

pattern = r"""                  <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                              <div className="text-xs text-muted-foreground">Signed Up Date</div>
                              <div className="font-medium">\{profile\.created_at \? format\(new Date\(profile\.created_at\), 'PPP'\) : 'N/A'\}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <div>
                              <div className="text-xs text-muted-foreground">Courses Bought</div>
                              <div className="font-medium">\{analytics\?\.globalStats\.totalEnrolled \|\| 0\} enrolled</div>
                          </div>
                      </div>
                  </div>"""

new_pattern = """                  <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                              <div className="text-xs text-muted-foreground">Signed Up Date</div>
                              <div className="font-medium">{profile.created_at ? format(new Date(profile.created_at), 'PPP') : 'N/A'}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <div>
                              <div className="text-xs text-muted-foreground">Courses Bought</div>
                              <div className="font-medium">{analytics?.globalStats.totalEnrolled || 0} enrolled</div>
                          </div>
                      </div>
                      {profile.phone && (
                          <div className="flex items-center gap-3">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                  <div className="text-xs text-muted-foreground">Phone</div>
                                  <div className="font-medium">{profile.phone}</div>
                              </div>
                          </div>
                      )}
                      {profile.fathers_name && (
                          <div className="flex items-center gap-3">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                  <div className="text-xs text-muted-foreground">Father's Name</div>
                                  <div className="font-medium">{profile.fathers_name}</div>
                              </div>
                          </div>
                      )}
                      {profile.mothers_name && (
                          <div className="flex items-center gap-3">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                  <div className="text-xs text-muted-foreground">Mother's Name</div>
                                  <div className="font-medium">{profile.mothers_name}</div>
                              </div>
                          </div>
                      )}
                      {profile.ssc_gpa && (
                          <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                  <div className="text-xs text-muted-foreground">SSC GPA</div>
                                  <div className="font-medium">{profile.ssc_gpa}</div>
                              </div>
                          </div>
                      )}
                      {profile.hsc_gpa && (
                          <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                  <div className="text-xs text-muted-foreground">HSC GPA</div>
                                  <div className="font-medium">{profile.hsc_gpa}</div>
                              </div>
                          </div>
                      )}
                  </div>"""

# Replace exactly
content = re.sub(pattern, new_pattern, content)

with open("src/pages/dashboard/admin/StudentProfileView.tsx", "w") as f:
    f.write(content)

print("Updated StudentProfileView details")
